-- Tarifas, zonas y aislamiento del envío.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@esquina.test'),
  ('22222222-2222-4222-8222-222222222222', 'bruno@barril.test');

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
  );

insert into public.sucursales (id, tienda_id, slug, nombre, lat, lng, activa) values
  (
    'bbbb0001-0001-4001-8001-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'centro',
    'Centro B',
    -16.5,
    -68.15,
    true
  ),
  (
    'bbbb0002-0002-4002-8002-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'norte',
    'Norte B',
    -16.4,
    -68.1,
    true
  );

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('bbbb2222-2222-4222-8222-222222222222', 'bbbb0001-0001-4001-8001-000000000001');

do $$
declare
  tarifa uuid;
  n integer;
begin
  if has_function_privilege(
    'authenticated',
    'public.guardar_tarifa(uuid, uuid, uuid, numeric, numeric, uuid)',
    'execute'
  )
  or has_function_privilege('anon', 'public.guardar_zona(uuid, uuid, uuid, text, double precision, double precision, numeric, text, numeric, boolean, uuid)', 'execute')
  then
    raise exception 'las funciones de envío quedaron ejecutables fuera del servidor';
  end if;

  tarifa := public.guardar_tarifa(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'bbbb0001-0001-4001-8001-000000000001',
    1,
    7,
    '22222222-2222-4222-8222-222222222222'
  );

  perform public.guardar_tarifa(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'bbbb0001-0001-4001-8001-000000000001',
    2,
    10,
    '22222222-2222-4222-8222-222222222222'
  );

  perform public.guardar_tarifa(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'bbbb0002-0002-4002-8002-000000000002',
    4,
    15,
    '22222222-2222-4222-8222-222222222222'
  );

  begin
    perform public.guardar_tarifa(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      null,
      'bbbb0001-0001-4001-8001-000000000001',
      1,
      9,
      '22222222-2222-4222-8222-222222222222'
    );
    raise exception 'aceptó un rango duplicado';
  exception
    when others then
      if sqlerrm not like '%ya existe%' then
        raise;
      end if;
  end;

  perform public.guardar_zona(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    'bbbb0001-0001-4001-8001-000000000001',
    'Centro',
    -16.5,
    -68.15,
    1.5,
    'bloqueada',
    null,
    true,
    '22222222-2222-4222-8222-222222222222'
  );

  begin
    perform public.guardar_zona(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      null,
      'bbbb0001-0001-4001-8001-000000000001',
      'Sin costo',
      -16.5,
      -68.15,
      1,
      'tarifa_fija',
      null,
      true,
      '22222222-2222-4222-8222-222222222222'
    );
    raise exception 'aceptó tarifa fija sin costo';
  exception
    when others then
      if sqlerrm not like '%costo%' then
        raise;
      end if;
  end;

  perform public.eliminar_tarifa(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    tarifa,
    '22222222-2222-4222-8222-222222222222'
  );

  select count(*) into n
  from public.tarifas_envio
  where sucursal_id = 'bbbb0001-0001-4001-8001-000000000001';
  if n <> 1 then
    raise exception 'quedaron % tarifas en el centro', n;
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.tarifas_envio;
  if n <> 0 then
    raise exception 'Ana ve % tarifas de otra tienda', n;
  end if;

  select count(*) into n from public.zonas_reparto;
  if n <> 0 then
    raise exception 'Ana ve zonas de otra tienda';
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
  from public.tarifas_envio
  where sucursal_id = 'bbbb0002-0002-4002-8002-000000000002';
  if n <> 0 then
    raise exception 'el vendedor ve tarifas de una sucursal ajena';
  end if;

  begin
    insert into public.tarifas_envio (tienda_id, sucursal_id, hasta_km, costo)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'bbbb0001-0001-4001-8001-000000000001',
      6,
      20
    );
    raise exception 'el vendedor pudo insertar una tarifa';
  exception
    when insufficient_privilege then
      null;
  end;

  execute 'reset role';
end
$$;

rollback;
