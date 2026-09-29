-- "Productos de la central en las sucursales": con el interruptor activado,
-- toda sucursal ofrece los mismos productos que la central (stock 0 hasta que
-- cargue el suyo). Se mantiene solo: productos nuevos, productos que la central
-- vuelve a ofrecer y sucursales nuevas.
-- La central es la primera sucursal activa por orden y nombre (igual que en el panel).
-- Repetible: se puede ejecutar aunque ya esté aplicada.

alter table public.configuracion_tienda
  add column if not exists catalogo_central boolean not null default false;

create or replace function public.sucursal_central(p_tienda uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.sucursales as s
  where s.tienda_id = p_tienda
    and s.activa
  order by s.orden, s.nombre
  limit 1;
$$;

-- Copia a las demás sucursales los productos que la central ofrece.
-- p_producto null = todo el catálogo; si no, solo ese producto.
create or replace function public.sincronizar_catalogo_central(p_tienda uuid, p_producto uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  central uuid := public.sucursal_central(p_tienda);
  copiados integer := 0;
begin
  if central is null then
    return 0;
  end if;

  insert into public.producto_sucursal (producto_id, sucursal_id, tienda_id, usa_precio_central, disponible)
  select ps.producto_id, s.id, p_tienda, true, true
  from public.producto_sucursal as ps
  cross join public.sucursales as s
  where ps.sucursal_id = central
    and ps.disponible
    and (p_producto is null or ps.producto_id = p_producto)
    and s.tienda_id = p_tienda
    and s.activa
    and s.id <> central
  on conflict (producto_id, sucursal_id) do update set disponible = true
  where not public.producto_sucursal.disponible;

  get diagnostics copiados = row_count;
  return copiados;
end;
$$;

-- La central ofrece un producto: se copia a las sucursales si el interruptor está activado.
create or replace function public.trg_catalogo_central_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.disponible
    and new.sucursal_id = public.sucursal_central(new.tienda_id)
    and exists (
      select 1 from public.configuracion_tienda as c
      where c.tienda_id = new.tienda_id and c.catalogo_central
    ) then
    perform public.sincronizar_catalogo_central(new.tienda_id, new.producto_id);
  end if;
  return null;
end;
$$;

drop trigger if exists producto_sucursal_catalogo_central on public.producto_sucursal;
create trigger producto_sucursal_catalogo_central
  after insert or update of disponible on public.producto_sucursal
  for each row
  execute function public.trg_catalogo_central_producto();

-- Sucursal nueva (o reactivada): recibe el catálogo de la central.
create or replace function public.trg_catalogo_central_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activa and exists (
    select 1 from public.configuracion_tienda as c
    where c.tienda_id = new.tienda_id and c.catalogo_central
  ) then
    perform public.sincronizar_catalogo_central(new.tienda_id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists sucursales_catalogo_central on public.sucursales;
create trigger sucursales_catalogo_central
  after insert or update of activa on public.sucursales
  for each row
  execute function public.trg_catalogo_central_sucursal();

-- Al activar el interruptor, se sincroniza todo el catálogo.
create or replace function public.trg_catalogo_central_activar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.catalogo_central and not coalesce(old.catalogo_central, false) then
    perform public.sincronizar_catalogo_central(new.tienda_id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists configuracion_catalogo_central on public.configuracion_tienda;
create trigger configuracion_catalogo_central
  after update of catalogo_central on public.configuracion_tienda
  for each row
  execute function public.trg_catalogo_central_activar();

revoke all on function public.sucursal_central(uuid) from public, anon, authenticated;
revoke all on function public.sincronizar_catalogo_central(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trg_catalogo_central_producto() from public, anon, authenticated;
revoke all on function public.trg_catalogo_central_sucursal() from public, anon, authenticated;
revoke all on function public.trg_catalogo_central_activar() from public, anon, authenticated;
grant execute on function public.sucursal_central(uuid) to service_role;
grant execute on function public.sincronizar_catalogo_central(uuid, uuid) to service_role;
