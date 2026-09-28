-- Pedidos, stock y aislamiento.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@esquina.test'),
  ('22222222-2222-4222-8222-222222222222', 'bruno@barril.test'),
  ('44444444-4444-4444-8444-444444444444', 'carla@barril.test');

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro';

insert into public.miembros (id, user_id, tienda_id, rol) values
  (
    'aaaa1111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dueno'
  ),
  (
    'bbbb2222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'vendedor'
  ),
  (
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
), (
  'bbbb0002-0002-4002-8002-000000000002',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'norte',
  'Norte B',
  -16.4,
  -68.1,
  true,
  true,
  true,
  true,
  '{}'::jsonb
);

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('bbbb2222-2222-4222-8222-222222222222', 'bbbb0001-0001-4001-8001-000000000001');

do $$
declare
  categoria uuid;
  producto uuid;
  pedido uuid;
  segundo uuid;
  delivery uuid;
  stock integer;
  total numeric;
  n integer;
  estado text;
begin
  if has_function_privilege(
    'authenticated',
    'public.crear_pedido(uuid, text, text, text, double precision, double precision, text, text, numeric, numeric, timestamptz, jsonb)',
    'execute'
  ) or has_function_privilege('anon', 'public.cambiar_estado(uuid, text, uuid)', 'execute') then
    raise exception 'las funciones de pedidos quedaron ejecutables fuera del servidor';
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
    -16.5,
    -68.15,
    'ignorada',
    null,
    99,
    99,
    null,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1, 'precio', 1))
  );

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto;
  if stock <> 1 then
    raise exception 'el pedido dejó stock %', stock;
  end if;

  select p.total, p.estado into total, estado
  from public.pedidos as p
  where p.id = pedido;
  if total <> 20 or estado <> 'pendiente' then
    raise exception 'el recojo no cobró el precio vigente';
  end if;

  select count(*) into n from public.pedidos where id = pedido and lat is null and costo_envio = 0;
  if n <> 1 then
    raise exception 'el recojo guardó coordenadas o envío';
  end if;

  begin
    perform public.crear_pedido(
      'bbbb0001-0001-4001-8001-000000000001',
      'Ana Cliente',
      '59171234567',
      'recojo',
      null, null, null, null, 0, 0, null,
      jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 2))
    );
    raise exception 'vendió más stock del que hay';
  exception
    when others then
      if sqlerrm not like '%stock suficiente%' then
        raise;
      end if;
  end;

  select ps.stock into stock from public.producto_sucursal as ps where ps.producto_id = producto;
  if stock <> 1 then
    raise exception 'el fallo de stock cambió el inventario a %', stock;
  end if;

  begin
    perform public.cambiar_estado(pedido, 'enviado', '22222222-2222-4222-8222-222222222222');
    raise exception 'pasó de nuevo a enviado';
  exception
    when others then
      if sqlerrm not like '%no está permitido%' then
        raise;
      end if;
  end;

  perform public.cambiar_estado(pedido, 'cancelado', '22222222-2222-4222-8222-222222222222');
  select ps.stock into stock from public.producto_sucursal as ps where ps.producto_id = producto;
  if stock <> 2 then
    raise exception 'la cancelación no devolvió el stock, quedó %', stock;
  end if;

  perform public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto, 1, 'entrada', 'Otra carga', '44444444-4444-4444-8444-444444444444'
  );

  delivery := public.crear_pedido(
    'bbbb0001-0001-4001-8001-000000000001',
    'Luis Cliente',
    '59169876543',
    'delivery',
    -16.51,
    -68.16,
    'Calle 1',
    'Portón azul',
    1.2,
    7,
    null,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1))
  );

  perform public.cambiar_estado(delivery, 'aceptado', '22222222-2222-4222-8222-222222222222');
  perform public.cambiar_estado(delivery, 'listo', '22222222-2222-4222-8222-222222222222');
  perform public.cambiar_estado(delivery, 'enviado', '22222222-2222-4222-8222-222222222222');

  select p.estado, p.total into estado, total from public.pedidos as p where p.id = delivery;
  if estado <> 'enviado' or total <> 27 then
    raise exception 'el delivery quedó % / %', estado, total;
  end if;

  begin
    perform public.cambiar_estado(delivery, 'cancelado', '11111111-1111-4111-8111-111111111111');
    raise exception 'Ana canceló un pedido de otra tienda';
  exception
    when others then
      if sqlerrm not like '%No puedes%' and sqlerrm not like '%no está permitido%' then
        raise;
      end if;
  end;

  segundo := public.crear_pedido(
    'bbbb0001-0001-4001-8001-000000000001',
    'Rosa',
    '59170000000',
    'recojo',
    null, null, null, null, 0, 0, null,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1))
  );
  perform public.cambiar_estado(segundo, 'aceptado', '44444444-4444-4444-8444-444444444444');
  perform public.cambiar_estado(segundo, 'listo', '44444444-4444-4444-8444-444444444444');
  begin
    perform public.cambiar_estado(segundo, 'enviado', '44444444-4444-4444-8444-444444444444');
    raise exception 'el recojo pasó a enviado';
  exception
    when others then
      if sqlerrm not like '%no está permitido%' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';
  select count(*) into n from public.pedidos;
  if n <> 0 then
    raise exception 'Ana ve % pedidos de otra tienda', n;
  end if;
  execute 'reset role';
end
$$;

rollback;
