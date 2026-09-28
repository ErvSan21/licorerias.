-- Stock, transferencias, importación y aislamiento del inventario.
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
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0001-0001-4001-8001-000000000001'),
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0002-0002-4002-8002-000000000002');

do $$
declare
  categoria uuid;
  producto uuid;
  stock integer;
  n integer;
  firma text;
begin
  if has_function_privilege(
    'public',
    'public.ajustar_stock(uuid, uuid, integer, text, text, uuid)',
    'execute'
  )
  or has_function_privilege(
    'anon',
    'public.ajustar_stock(uuid, uuid, integer, text, text, uuid)',
    'execute'
  )
  or has_function_privilege(
    'authenticated',
    'public.ajustar_stock(uuid, uuid, integer, text, text, uuid)',
    'execute'
  ) then
    raise exception 'ajustar_stock quedó ejecutable fuera del servidor';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.transferir_stock(uuid, uuid, uuid, integer, uuid)',
    'execute'
  ) then
    raise exception 'service_role no puede transferir';
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cervezas')
  returning id into categoria;

  producto := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Paceña',
    null,
    categoria,
    12,
    array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  select ps.stock, ps.stock_minimo
  into stock, n
  from public.producto_sucursal as ps
  where ps.producto_id = producto;

  if stock <> 0 or n <> 5 then
    raise exception 'el stock nuevo no nace en 0 con mínimo 5 (% / %)', stock, n;
  end if;

  stock := public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto,
    10,
    'entrada',
    'Compra',
    '44444444-4444-4444-8444-444444444444'
  );
  if stock <> 10 then
    raise exception 'la entrada dejó %', stock;
  end if;

  begin
    perform public.ajustar_stock(
      'bbbb0001-0001-4001-8001-000000000001',
      producto,
      11,
      'salida',
      'Merma',
      '44444444-4444-4444-8444-444444444444'
    );
    raise exception 'la salida debió fallar';
  exception
    when others then
      if sqlerrm not like '%No hay stock suficiente%' then
        raise;
      end if;
  end;

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if stock <> 10 then
    raise exception 'una salida fallida cambió el stock a %', stock;
  end if;

  stock := public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto,
    4,
    'ajuste',
    'Conteo',
    '44444444-4444-4444-8444-444444444444'
  );
  if stock <> 4 then
    raise exception 'el ajuste dejó %', stock;
  end if;

  begin
    perform public.transferir_stock(
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002',
      producto,
      2,
      '44444444-4444-4444-8444-444444444444'
    );
    raise exception 'la transferencia debió pedir disponibilidad';
  exception
    when others then
      if sqlerrm not like '%Define primero la disponibilidad%' then
        raise;
      end if;
  end;

  perform public.fijar_sucursales_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    producto,
    array[
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002'
    ]::uuid[]
  );

  perform public.transferir_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    'bbbb0002-0002-4002-8002-000000000002',
    producto,
    2,
    '44444444-4444-4444-8444-444444444444'
  );

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if stock <> 2 then
    raise exception 'el origen quedó en %', stock;
  end if;

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if stock <> 2 then
    raise exception 'el destino quedó en %', stock;
  end if;

  select count(*) into n
  from public.movimientos_stock
  where producto_id = producto
    and tipo in ('transferencia_in', 'transferencia_out');
  if n <> 2 then
    raise exception 'se esperaban 2 movimientos de transferencia, hay %', n;
  end if;

  select count(*) into n from public.transferencias_stock where producto_id = producto;
  if n <> 1 then
    raise exception 'falta la transferencia';
  end if;

  n := public.importar_stock(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    jsonb_build_array(
      jsonb_build_object(
        'linea', 2,
        'sucursal', 'centro',
        'categoria', 'Cervezas',
        'producto', 'Paceña',
        'stock', 9,
        'stock_minimo', 3
      )
    ),
    array[
      'bbbb0001-0001-4001-8001-000000000001',
      'bbbb0002-0002-4002-8002-000000000002'
    ]::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );
  if n <> 1 then
    raise exception 'la importación aplicó % filas', n;
  end if;

  select ps.stock, ps.stock_minimo into stock, n
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if stock <> 9 or n <> 3 then
    raise exception 'el csv dejó % / %', stock, n;
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.movimientos_stock;
  if n <> 0 then
    raise exception 'Ana ve % movimientos de otra tienda', n;
  end if;

  select count(*) into n from public.transferencias_stock;
  if n <> 0 then
    raise exception 'Ana ve transferencias de otra tienda';
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n
  from public.movimientos_stock
  where sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if n <> 0 then
    raise exception 'el vendedor ve movimientos de una sucursal ajena';
  end if;

  begin
    update public.producto_sucursal
    set stock = 99
    where sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
    raise exception 'el vendedor pudo ejecutar el update';
  exception
    when insufficient_privilege then
      null;
  end;

  execute 'reset role';

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if stock <> 9 then
    raise exception 'el update directo del vendedor sí cambió el stock';
  end if;

  select pg_get_function_identity_arguments(p.oid)
  into firma
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'ajustar_stock';
  if firma is null then
    raise exception 'falta ajustar_stock';
  end if;
end
$$;

rollback;
