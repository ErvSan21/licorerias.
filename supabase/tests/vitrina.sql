-- Vitrina pública: precio vigente, agotado sin stock exacto, colecciones y licencia.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@esquina.test'),
  ('44444444-4444-4444-8444-444444444444', 'carla@barril.test');

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cerrada-c', 'Cerrada C');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro'
where t.slug <> 'cerrada-c';

insert into public.miembros (id, user_id, tienda_id, rol) values
  (
    'bbbb4444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dueno'
  );

insert into public.sucursales (
  id, tienda_id, slug, nombre, direccion, lat, lng, abierta, acepta_delivery, acepta_recojo, activa, horario
) values (
  'bbbb0001-0001-4001-8001-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'centro',
  'Centro B',
  'Calle 1',
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
  'Calle 2',
  -16.4,
  -68.1,
  true,
  false,
  true,
  true,
  '{}'::jsonb
);

do $$
declare
  categoria uuid;
  producto uuid;
  otro uuid;
  vitrina jsonb;
  precio numeric;
  origen text;
  agotado boolean;
  n integer;
begin
  if has_function_privilege('authenticated', 'public.vitrina_publica(text, text)', 'execute')
    or has_function_privilege('anon', 'public.escaparate(text)', 'execute') then
    raise exception 'la vitrina quedó ejecutable fuera del servidor';
  end if;

  if public.abierta_ahora(false, '{}'::jsonb) then
    raise exception 'una sucursal marcada cerrada salió abierta';
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cervezas')
  returning id into categoria;

  producto := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Paceña',
    'Botella',
    categoria,
    20,
    array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  otro := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Oculto',
    null,
    categoria,
    10,
    array['bbbb0002-0002-4002-8002-000000000002']::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  vitrina := public.vitrina_publica('barril-b', 'centro');
  if vitrina::text like '%"stock"%' then
    raise exception 'la vitrina expuso el stock';
  end if;
  select (item ->> 'agotado')::boolean into agotado
  from jsonb_array_elements(vitrina -> 'productos') as item
  where item ->> 'nombre' = 'Paceña';
  if agotado is not true then
    raise exception 'sin stock no salió agotado';
  end if;

  perform public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto, 2, 'entrada', 'Carga', '44444444-4444-4444-8444-444444444444'
  );
  perform public.guardar_oferta(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    producto,
    null,
    'porcentaje',
    10,
    now() - interval '1 hour',
    now() + interval '1 day',
    true,
    '44444444-4444-4444-8444-444444444444'
  );
  perform public.guardar_coleccion(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'Frías',
    null,
    now() - interval '1 hour',
    now() + interval '1 day',
    true,
    array[producto],
    '44444444-4444-4444-8444-444444444444'
  );
  perform public.guardar_coleccion(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'Mañana',
    null,
    now() + interval '1 day',
    now() + interval '2 days',
    true,
    array[producto],
    '44444444-4444-4444-8444-444444444444'
  );

  vitrina := public.vitrina_publica('barril-b', 'centro');
  select (item ->> 'precioFinal')::numeric, item ->> 'origen'
  into precio, origen
  from jsonb_array_elements(vitrina -> 'productos') as item
  where item ->> 'id' = producto::text;
  if origen <> 'oferta' then
    raise exception 'el origen no fue oferta, fue %', origen;
  end if;
  if precio <> 18 then
    raise exception 'no aplicó la oferta, quedó %', precio;
  end if;
  select count(*) into n from jsonb_array_elements(vitrina -> 'productos') as item where item ->> 'id' = otro::text;
  if n <> 0 then
    raise exception 'mostró un producto de otra sucursal';
  end if;
  select count(*) into n from jsonb_array_elements(vitrina -> 'colecciones') as item;
  if n <> 1 or (vitrina -> 'colecciones' -> 0 ->> 'nombre') <> 'Frías' then
    raise exception 'las colecciones vigentes no coinciden';
  end if;
  if (vitrina -> 'sucursal' ->> 'abiertaAhora')::boolean is not true then
    raise exception 'el centro salió cerrado';
  end if;

  vitrina := public.vitrina_publica('barril-b', 'norte');
  if (vitrina -> 'sucursal' ->> 'abiertaAhora')::boolean then
    raise exception 'el norte sin horario salió abierto';
  end if;
  if (vitrina -> 'sucursal' ->> 'aceptaDelivery')::boolean then
    raise exception 'el norte aceptó delivery';
  end if;

  begin
    perform public.escaparate('cerrada-c');
    raise exception 'la tienda sin licencia se publicó';
  exception
    when others then
      if sqlerrm not like '%no disponible%' then
        raise;
      end if;
  end;
end
$$;

rollback;
