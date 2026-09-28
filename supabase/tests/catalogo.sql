-- Precio base, margen, cupo de productos y aislamiento del catálogo.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@esquina.test'),
  ('22222222-2222-4222-8222-222222222222', 'bruno@barril.test'),
  ('44444444-4444-4444-8444-444444444444', 'carla@barril.test'),
  ('33333333-3333-4333-8333-333333333333', 'super@plataforma.test');

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  id,
  'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.planes
where nombre = 'Básico';

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  id,
  'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.planes
where nombre = 'Pro';

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

insert into public.super_admins (user_id) values
  ('33333333-3333-4333-8333-333333333333');

insert into public.sucursales (id, tienda_id, slug, nombre, activa) values
  (
    'aaaa0001-0001-4001-8001-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'centro',
    'Centro A',
    true
  ),
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
  );

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('bbbb2222-2222-4222-8222-222222222222', 'bbbb0001-0001-4001-8001-000000000001'),
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0002-0002-4002-8002-000000000002');

create temp table prueba_ids (
  clave text primary key,
  id uuid not null
);

do $$
declare
  categoria_a uuid;
  categoria_b uuid;
  producto_a uuid;
  producto_b uuid;
  base numeric;
  cambiados integer;
  definidor boolean;
  config text[];
  n int;
begin
  if (
    select count(*)
    from public.configuracion_tienda
    where tienda_id in (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  ) <> 2 then
    raise exception 'cada tienda debe nacer con configuracion de precios';
  end if;

  insert into public.categorias (tienda_id, nombre, orden)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vinos', 1)
  returning id into categoria_a;

  insert into public.categorias (tienda_id, nombre, orden)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cervezas', 1)
  returning id into categoria_b;

  producto_a := public.crear_producto(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Singani',
    'Botella',
    categoria_a,
    25,
    array['aaaa0001-0001-4001-8001-000000000001']::uuid[],
    '11111111-1111-4111-8111-111111111111'
  );

  producto_b := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Paceña',
    null,
    categoria_b,
    12,
    array[
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002'
    ]::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  insert into prueba_ids (clave, id) values
    ('categoria_a', categoria_a),
    ('categoria_b', categoria_b),
    ('producto_a', producto_a),
    ('producto_b', producto_b);

  base := public.precio_base(producto_a, 'aaaa0001-0001-4001-8001-000000000001');
  if base <> 25 then
    raise exception 'precio_base central dio %', base;
  end if;

  begin
    update public.productos set precio_central = 40 where id = producto_a;
    raise exception 'un update directo cambio el precio central';
  exception
    when others then
      if sqlerrm <> 'El precio central solo lo cambia el servidor.' then
        raise exception 'mensaje de precio directo: %', sqlerrm;
      end if;
  end;

  begin
    perform public.crear_producto(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Ajeno',
      null,
      categoria_b,
      10,
      '{}'::uuid[],
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'se uso una categoria de otra tienda';
  exception
    when others then
      if sqlerrm <> 'La categoría no pertenece a la tienda.' then
        raise exception 'mensaje de categoria: %', sqlerrm;
      end if;
  end;

  begin
    perform public.crear_producto(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Cruce',
      null,
      null,
      10,
      array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'se ofrecio un producto de A en una sucursal de B';
  exception
    when others then
      if sqlerrm <> 'La sucursal no pertenece a la tienda.' then
        raise exception 'mensaje de sucursal: %', sqlerrm;
      end if;
  end;

  perform public.guardar_precio_sucursal(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    producto_a,
    'aaaa0001-0001-4001-8001-000000000001',
    false,
    30,
    '11111111-1111-4111-8111-111111111111'
  );

  base := public.precio_base(producto_a, 'aaaa0001-0001-4001-8001-000000000001');
  if base <> 30 then
    raise exception 'precio_base propio dio %', base;
  end if;

  begin
    perform public.guardar_configuracion_precios(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      true,
      10,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'el margen acepto un precio propio por encima';
  exception
    when others then
      if sqlerrm <> 'Hay precios propios por encima del margen máximo.' then
        raise exception 'mensaje de margen: %', sqlerrm;
      end if;
  end;

  perform public.guardar_precio_sucursal(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    producto_a,
    'aaaa0001-0001-4001-8001-000000000001',
    false,
    27.50,
    '11111111-1111-4111-8111-111111111111'
  );

  perform public.guardar_configuracion_precios(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    true,
    10,
    '11111111-1111-4111-8111-111111111111'
  );

  begin
    perform public.guardar_precio_central(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      producto_a,
      20,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'bajar el central dejo un propio fuera de margen';
  exception
    when others then
      if sqlerrm <> 'Hay precios propios que superarían el margen máximo.' then
        raise exception 'mensaje al bajar central: %', sqlerrm;
      end if;
  end;

  perform public.guardar_configuracion_precios(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    false,
    null,
    '11111111-1111-4111-8111-111111111111'
  );

  base := public.precio_base(producto_a, 'aaaa0001-0001-4001-8001-000000000001');
  if base <> 25 then
    raise exception 'al bloquear precios propios, la base quedo en %', base;
  end if;

  begin
    perform public.guardar_precio_sucursal(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      producto_a,
      'aaaa0001-0001-4001-8001-000000000001',
      false,
      26,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'se fijo un precio propio con la opcion bloqueada';
  exception
    when others then
      if sqlerrm <> 'Esta tienda no permite precios propios.' then
        raise exception 'mensaje de bloqueo: %', sqlerrm;
      end if;
  end;

  perform public.guardar_configuracion_precios(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    true,
    null,
    '11111111-1111-4111-8111-111111111111'
  );

  perform public.guardar_precio_sucursal(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    producto_b,
    'bbbb0001-0001-4001-8001-000000000001',
    false,
    15,
    '44444444-4444-4444-8444-444444444444'
  );

  perform public.fijar_sucursales_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    producto_b,
    array[
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002'
    ]::uuid[]
  );

  cambiados := public.copiar_precios_propios(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbb0001-0001-4001-8001-000000000001',
    'bbbb0002-0002-4002-8002-000000000002',
    '44444444-4444-4444-8444-444444444444'
  );
  if cambiados <> 1 then
    raise exception 'copiar precios propios cambio % filas', cambiados;
  end if;

  base := public.precio_base(producto_b, 'bbbb0002-0002-4002-8002-000000000002');
  if base <> 15 then
    raise exception 'el norte no recibio el precio copiado: %', base;
  end if;

  cambiados := public.ajustar_precios_propios(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbb0002-0002-4002-8002-000000000002',
    10,
    '44444444-4444-4444-8444-444444444444'
  );
  if cambiados <> 1 then
    raise exception 'el ajuste propio cambio % filas', cambiados;
  end if;

  base := public.precio_base(producto_b, 'bbbb0002-0002-4002-8002-000000000002');
  if base <> 16.50 then
    raise exception 'el ajuste propio dio %', base;
  end if;

  cambiados := public.volver_precios_centrales(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbb0002-0002-4002-8002-000000000002',
    '44444444-4444-4444-8444-444444444444'
  );
  if cambiados <> 1 then
    raise exception 'volver al central cambio % filas', cambiados;
  end if;

  base := public.precio_base(producto_b, 'bbbb0002-0002-4002-8002-000000000002');
  if base <> 12 then
    raise exception 'volver al central dio %', base;
  end if;

  cambiados := public.ajustar_precio_central_categoria(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoria_a,
    10,
    '11111111-1111-4111-8111-111111111111'
  );
  if cambiados <> 1 then
    raise exception 'el ajuste central cambio % filas', cambiados;
  end if;

  if (
    select precio_central
    from public.productos
    where id = producto_a
  ) <> 27.50 then
    raise exception 'el precio central no subio 10 por ciento';
  end if;

  update public.producto_sucursal
  set disponible = false
  where producto_id = producto_a;

  if public.precio_base(producto_a, 'aaaa0001-0001-4001-8001-000000000001') is not null then
    raise exception 'un producto no disponible sigue teniendo precio base';
  end if;

  update public.producto_sucursal
  set disponible = true
  where producto_id = producto_a;

  begin
    update public.planes set max_productos = 1 where nombre = 'Básico';
    perform public.crear_producto(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Extra',
      null,
      null,
      8,
      '{}'::uuid[],
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'el cupo de productos no bloqueo';
  exception
    when others then
      if sqlerrm <> 'Has alcanzado el máximo de productos de tu plan' then
        raise exception 'mensaje de cupo: %', sqlerrm;
      end if;
  end;

  select p.prosecdef, p.proconfig
    into definidor, config
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'precio_base';

  if definidor is not true or not (config @> array['search_path=public']) then
    raise exception 'precio_base no queda solo en el servidor: %', config;
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'precio_base'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE';

  if n <> 0 then
    raise exception 'authenticated puede ejecutar precio_base';
  end if;

  if (
    select count(*)
    from public.historial_precios
    where producto_id = producto_a
      and tipo = 'central'
      and sucursal_id is null
  ) < 2 then
    raise exception 'falta historial del precio central';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  execute 'set local role authenticated';

  select count(*) into n from public.productos;
  if n <> 1 then
    raise exception 'Ana ve % productos; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.productos
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'Ana ve productos de B';
  end if;

  select count(*) into n from public.producto_sucursal;
  if n <> 1 then
    raise exception 'Ana ve % filas de sucursal; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.historial_precios
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    and sucursal_id is not null;
  if n <> 0 then
    raise exception 'Ana ve historial propio de B';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  execute 'set local role authenticated';

  select count(*) into n from public.producto_sucursal;
  if n <> 1 then
    raise exception 'Bruno ve % filas de sucursal; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.producto_sucursal
  where sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if n <> 0 then
    raise exception 'Bruno ve la sucursal norte';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
  execute 'set local role authenticated';

  select count(*) into n
  from public.producto_sucursal
  where sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if n <> 1 then
    raise exception 'Carla no ve su sucursal';
  end if;

  select count(*) into n
  from public.producto_sucursal
  where sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if n <> 0 then
    raise exception 'Carla ve el centro sin asignacion';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  execute 'set local role authenticated';

  select count(*) into n from public.productos;
  if n <> 2 then
    raise exception 'super admin ve % productos; se esperaban 2', n;
  end if;
end
$$;

do $$
begin
  execute 'set local role anon';
  begin
    perform 1 from public.productos;
    raise exception 'anon pudo leer productos';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

rollback;
