-- Reportes: la sucursal de otra tienda no entra, y anon no ejecuta la función.

begin;

insert into auth.users (id, email) values
  ('44444444-4444-4444-8444-444444444444', 'carla@barril.test');

insert into public.tiendas (id, slug, nombre) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro';

insert into public.miembros (id, user_id, tienda_id, rol) values (
  'bbbb4444-4444-4444-8444-444444444444',
  '44444444-4444-4444-8444-444444444444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dueno'
);

insert into public.sucursales (
  id, tienda_id, slug, nombre, lat, lng, abierta, acepta_delivery, acepta_recojo, activa, horario
) values (
  'bbbb0001-0001-4001-8001-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'centro',
  'Centro B',
  -16.5,
  -68.15,
  true,
  true,
  true,
  true,
  '{
    "lun":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "mar":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "mie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "jue":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "vie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "sab":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "dom":{"abierto":true,"desde":"00:00","hasta":"23:59"}
  }'::jsonb
);

do $$
declare
  categoria uuid;
  producto uuid;
  pedido uuid;
  vista jsonb;
  dia date := (now() at time zone 'America/La_Paz')::date;
begin
  if has_function_privilege('anon', 'public.reporte_tienda(uuid, uuid[], date, date)', 'execute')
    or has_function_privilege('authenticated', 'public.reporte_tienda(uuid, uuid[], date, date)', 'execute') then
    raise exception 'el reporte quedó ejecutable fuera del servidor';
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cervezas')
  returning id into categoria;

  producto := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Paceña',
    null,
    categoria,
    20,
    array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  perform public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto,
    2,
    'entrada',
    'Carga',
    '44444444-4444-4444-8444-444444444444'
  );

  pedido := public.crear_pedido(
    'bbbb0001-0001-4001-8001-000000000001',
    'Ana Cliente',
    '59171234567',
    'recojo',
    null, null, null, null, 0, 0, null,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1))
  );
  perform public.cambiar_estado(pedido, 'aceptado', '44444444-4444-4444-8444-444444444444');

  vista := public.reporte_tienda(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
    dia,
    dia
  );

  if (vista ->> 'ventas')::numeric <> 20
    or (vista ->> 'pedidos')::int <> 1
    or (vista ->> 'ticket')::numeric <> 20
    or vista -> 'masVendido' ->> 'nombre' <> 'Paceña'
    or (vista -> 'inventario' -> 0 ->> 'valor')::numeric <> 20
    or vista -> 'origenes' -> 0 ->> 'origen' <> 'central'
    or (vista -> 'origenes' -> 0 ->> 'ventas')::numeric <> 20
    or vista -> 'personal' -> 0 ->> 'usuario' <> 'carla@barril.test' then
    raise exception 'el reporte no cuadra %', vista;
  end if;

  if vista::text like '%59171234567%' then
    raise exception 'el reporte expone el teléfono del cliente';
  end if;

  begin
    perform public.reporte_tienda(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      array['ffffffff-ffff-4fff-8fff-ffffffffffff']::uuid[],
      dia,
      dia
    );
    raise exception 'aceptó una sucursal de otra tienda';
  exception
    when others then
      if sqlerrm not like '%no pertenece%' then
        raise;
      end if;
  end;
end
$$;

rollback;
