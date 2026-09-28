-- Comprueba la semilla ya aplicada. No la inserta.

do $$
declare
  n int;
  propios int;
  centrales int;
begin
  if exists (select 1 from public.tiendas where slug = 'esquina') then
    raise exception 'la semilla no debe crear el slug esquina';
  end if;

  select count(*) into n
  from public.sucursales as s
  join public.tiendas as t on t.id = s.tienda_id
  where t.slug = 'demo-centro';
  if n <> 1 then
    raise exception 'demo-centro tiene % sucursales', n;
  end if;

  select count(*) into n
  from public.sucursales as s
  join public.tiendas as t on t.id = s.tienda_id
  where t.slug = 'demo-cadena';
  if n <> 3 then
    raise exception 'demo-cadena tiene % sucursales', n;
  end if;

  select count(*) into centrales
  from public.producto_sucursal as ps
  join public.sucursales as s on s.id = ps.sucursal_id
  join public.tiendas as t on t.id = s.tienda_id
  where t.slug = 'demo-cadena'
    and s.slug = 'centro'
    and ps.usa_precio_central;

  if centrales < 1 then
    raise exception 'centro no usa precio central';
  end if;

  select count(*) into centrales
  from public.producto_sucursal as ps
  join public.sucursales as s on s.id = ps.sucursal_id
  join public.tiendas as t on t.id = s.tienda_id
  where t.slug = 'demo-cadena'
    and s.slug = 'sur'
    and ps.usa_precio_central;

  if centrales < 1 then
    raise exception 'sur no usa precio central';
  end if;

  select count(*) into propios
  from public.producto_sucursal as ps
  join public.sucursales as s on s.id = ps.sucursal_id
  join public.tiendas as t on t.id = s.tienda_id
  where t.slug = 'demo-cadena'
    and s.slug = 'norte'
    and not ps.usa_precio_central
    and ps.precio_propio = 18;

  if propios <> 1 then
    raise exception 'norte no quedó con precio propio 18';
  end if;

  select count(*) into n
  from public.producto_sucursal as ps
  join public.tiendas as t on t.id = ps.tienda_id
  where t.slug = 'demo-centro'
    and not ps.usa_precio_central;

  if n <> 0 then
    raise exception 'demo-centro tiene un precio propio';
  end if;

  perform public.exigir_licencia_vigente(t.id)
  from public.tiendas as t
  where t.slug in ('demo-centro', 'demo-cadena');
end
$$;
