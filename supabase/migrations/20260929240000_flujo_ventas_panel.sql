-- Flujo propio para las ventas cargadas desde el panel (origen = 'panel').
--   Recojo:   pendiente (Registrado) → aceptado → entregado
--   Delivery: pendiente (Registrado) → aceptado → preparando → recogido → entregado
-- Los pedidos de la tienda pública (origen = 'tienda') siguen con
--   pendiente → aceptado → listo (→ enviado en delivery).
-- Los pedidos existentes quedan como 'tienda' y no cambian de estado.

-- Repetible: se puede ejecutar aunque una parte ya esté aplicada.
alter table public.pedidos
  add column if not exists origen text not null default 'tienda';

alter table public.pedidos
  drop constraint if exists pedidos_origen;

alter table public.pedidos
  add constraint pedidos_origen check (origen in ('tienda', 'panel'));

-- Quién registró la venta en el panel (null en pedidos de la tienda pública).
alter table public.pedidos
  add column if not exists vendido_por uuid references auth.users (id) on delete set null;

alter table public.pedidos
  drop constraint if exists pedidos_estado;

alter table public.pedidos
  add constraint pedidos_estado check (
    estado in ('pendiente', 'aceptado', 'listo', 'enviado', 'preparando', 'recogido', 'entregado', 'cancelado')
  );

alter table public.pedido_historial
  drop constraint if exists pedido_historial_estado;

alter table public.pedido_historial
  add constraint pedido_historial_estado check (
    estado in ('pendiente', 'aceptado', 'listo', 'enviado', 'preparando', 'recogido', 'entregado', 'cancelado')
  );

-- Igual que en 20260929000000_pedidos.sql salvo los pasos permitidos, que dependen del origen.
create or replace function public.cambiar_estado(p_pedido uuid, p_nuevo text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedidos%rowtype;
  item record;
  permitido boolean := false;
begin
  if p_nuevo not in ('aceptado', 'listo', 'enviado', 'preparando', 'recogido', 'entregado', 'cancelado') then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  select * into ped from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;

  if not exists (
    select 1
    from public.miembros as m
    where m.user_id = p_user
      and m.tienda_id = ped.tienda_id
      and m.activo
      and (
        m.rol = 'dueno'
        or exists (
          select 1
          from public.miembro_sucursales as ms
          where ms.miembro_id = m.id
            and ms.sucursal_id = ped.sucursal_id
        )
      )
  ) then
    raise exception 'No puedes cambiar este pedido.';
  end if;

  if ped.origen = 'panel' then
    if ped.estado = 'pendiente' and p_nuevo in ('aceptado', 'cancelado') then
      permitido := true;
    elsif ped.tipo_entrega = 'recojo' and ped.estado = 'aceptado' and p_nuevo in ('entregado', 'cancelado') then
      permitido := true;
    elsif ped.tipo_entrega = 'delivery' and ped.estado = 'aceptado' and p_nuevo in ('preparando', 'cancelado') then
      permitido := true;
    elsif ped.tipo_entrega = 'delivery' and ped.estado = 'preparando' and p_nuevo in ('recogido', 'cancelado') then
      permitido := true;
    elsif ped.tipo_entrega = 'delivery' and ped.estado = 'recogido' and p_nuevo = 'entregado' then
      permitido := true;
    end if;
  else
    if ped.estado = 'pendiente' and p_nuevo in ('aceptado', 'cancelado') then
      permitido := true;
    elsif ped.estado = 'aceptado' and p_nuevo in ('listo', 'cancelado') then
      permitido := true;
    elsif ped.estado = 'listo' and p_nuevo = 'enviado' and ped.tipo_entrega = 'delivery' then
      permitido := true;
    end if;
  end if;

  if not permitido then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  if p_nuevo = 'cancelado' then
    for item in
      select producto_id, cantidad
      from public.pedido_items
      where pedido_id = ped.id
      order by producto_id
    loop
      perform public.ajustar_stock(
        ped.sucursal_id,
        item.producto_id,
        item.cantidad,
        'cancelacion',
        'Cancelación de pedido',
        p_user
      );
    end loop;
  end if;

  update public.pedidos set estado = p_nuevo where id = ped.id;
  insert into public.pedido_historial (pedido_id, tienda_id, estado, user_id)
  values (ped.id, ped.tienda_id, p_nuevo, p_user);
  return p_nuevo;
end;
$$;
