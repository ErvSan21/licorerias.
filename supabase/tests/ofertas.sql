-- Precio vigente, ofertas, colecciones y aislamiento.
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
select
  t.id,
  p.id,
  'activa',
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
    'gerente'
  );

insert into public.sucursales (id, tienda_id, slug, nombre, activa) values
  (
    'bbbb0001-0001-4001-8001-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'centro',
    'Centro B',
    true
  ),
  (
    'bbbb0002-0002-4002-8002-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'norte',
    'Norte B',
    true
  ),
  (
    'aaaa0001-0001-4001-8001-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'centro',
    'Centro A',
    true
  );

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('bbbb2222-2222-4222-8222-222222222222', 'bbbb0001-0001-4001-8001-000000000001'),
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0001-0001-4001-8001-000000000001'),
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0002-0002-4002-8002-000000000002');

do $$
declare
  categoria uuid;
  producto uuid;
  ajeno uuid;
  precio jsonb;
  coleccion uuid;
  n integer;
begin
  if has_function_privilege('public', 'public.precio_vigente(uuid, uuid)', 'execute')
    or has_function_privilege('anon', 'public.precio_vigente(uuid, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.precio_vigente(uuid, uuid)', 'execute')
    or has_function_privilege(
      'authenticated',
      'public.guardar_oferta(uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, boolean, uuid)',
      'execute'
    ) then
    raise exception 'las funciones de ofertas quedaron ejecutables fuera del servidor';
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
    array[
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002'
    ]::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  precio := public.precio_vigente(producto, 'bbbb0001-0001-4001-8001-000000000001');
  if (precio->>'precio_final')::numeric <> 20 or precio->>'origen_precio' <> 'central' then
    raise exception 'sin oferta el precio vigente es %', precio;
  end if;

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

  precio := public.precio_vigente(producto, 'bbbb0002-0002-4002-8002-000000000002');
  if (precio->>'precio_final')::numeric <> 18 or precio->>'origen_precio' <> 'oferta' then
    raise exception 'el porcentaje no aplicó en el norte: %', precio;
  end if;

  perform public.guardar_oferta(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    producto,
    'bbbb0001-0001-4001-8001-000000000001',
    'precio_fijo',
    15,
    now() - interval '1 hour',
    now() + interval '1 day',
    true,
    '44444444-4444-4444-8444-444444444444'
  );

  precio := public.precio_vigente(producto, 'bbbb0001-0001-4001-8001-000000000001');
  if (precio->>'precio_original')::numeric <> 20
    or (precio->>'precio_final')::numeric <> 15
    or precio->>'origen_precio' <> 'oferta' then
    raise exception 'el precio fijo más bajo no ganó: %', precio;
  end if;

  precio := public.precio_vigente(producto, 'bbbb0002-0002-4002-8002-000000000002');
  if (precio->>'precio_final')::numeric <> 18 then
    raise exception 'el precio fijo del centro se coló en el norte: %', precio;
  end if;

  perform public.guardar_oferta(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    producto,
    'bbbb0001-0001-4001-8001-000000000001',
    'precio_fijo',
    19,
    now() - interval '1 hour',
    now() + interval '1 day',
    true,
    '44444444-4444-4444-8444-444444444444'
  );
  precio := public.precio_vigente(producto, 'bbbb0001-0001-4001-8001-000000000001');
  if (precio->>'precio_final')::numeric <> 15 then
    raise exception 'una oferta más cara reemplazó a la barata: %', precio;
  end if;

  perform public.guardar_oferta(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    producto,
    'bbbb0002-0002-4002-8002-000000000002',
    'porcentaje',
    50,
    now() + interval '2 days',
    now() + interval '3 days',
    true,
    '44444444-4444-4444-8444-444444444444'
  );
  precio := public.precio_vigente(producto, 'bbbb0002-0002-4002-8002-000000000002');
  if (precio->>'precio_final')::numeric <> 18 then
    raise exception 'una oferta programada ya descuenta: %', precio;
  end if;

  begin
    perform public.guardar_oferta(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      null,
      producto,
      null,
      'precio_fijo',
      9,
      now() - interval '1 hour',
      now() + interval '1 day',
      true,
      '44444444-4444-4444-8444-444444444444'
    );
    raise exception 'aceptó un precio fijo sin sucursal';
  exception
    when others then
      if sqlerrm not like '%precio fijo%' then
        raise;
      end if;
  end;

  coleccion := public.guardar_coleccion(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'Fin de semana',
    'Cervezas en oferta',
    now() - interval '1 hour',
    now() + interval '2 days',
    true,
    array[producto],
    '44444444-4444-4444-8444-444444444444'
  );

  select count(*) into n
  from public.coleccion_productos
  where coleccion_id = coleccion
    and producto_id = producto;
  if n <> 1 then
    raise exception 'la colección no guardó el producto';
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vinos')
  returning id into categoria;

  ajeno := public.crear_producto(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Tannat',
    null,
    categoria,
    40,
    array['aaaa0001-0001-4001-8001-000000000001']::uuid[],
    '11111111-1111-4111-8111-111111111111'
  );

  begin
    perform public.guardar_coleccion(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      coleccion,
      'Fin de semana',
      null,
      now() - interval '1 hour',
      now() + interval '2 days',
      true,
      array[ajeno],
      '44444444-4444-4444-8444-444444444444'
    );
    raise exception 'la colección aceptó un producto de otra tienda';
  exception
    when others then
      if sqlerrm not like '%no pertenece%' then
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

  select count(*) into n from public.ofertas;
  if n <> 0 then
    raise exception 'Ana ve % ofertas de otra tienda', n;
  end if;

  select count(*) into n from public.colecciones;
  if n <> 0 then
    raise exception 'Ana ve colecciones de otra tienda';
  end if;

  begin
    perform public.precio_vigente(producto, 'bbbb0001-0001-4001-8001-000000000001');
    raise exception 'authenticated ejecutó precio_vigente';
  exception
    when insufficient_privilege then
      null;
  end;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n
  from public.ofertas
  where sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if n <> 0 then
    raise exception 'el vendedor ve una oferta de una sucursal ajena';
  end if;

  select count(*) into n from public.ofertas;
  if n <> 3 then
    raise exception 'el vendedor ve % ofertas y deberían ser 3', n;
  end if;

  begin
    insert into public.ofertas (tienda_id, producto_id, sucursal_id, tipo, valor, inicio, fin)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      producto,
      'bbbb0001-0001-4001-8001-000000000001',
      'precio_fijo',
      1,
      now(),
      now() + interval '1 day'
    );
    raise exception 'el vendedor pudo insertar una oferta';
  exception
    when insufficient_privilege then
      null;
  end;

  execute 'reset role';
end
$$;

rollback;
