-- Acceso por sucursal, cupo del plan y aislamiento.
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

insert into public.sucursales (id, tienda_id, slug, nombre, telefono, activa) values
  (
    'aaaa0001-0001-4001-8001-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'centro',
    'Centro A',
    '59170123456',
    true
  ),
  (
    'bbbb0001-0001-4001-8001-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'centro',
    'Centro B',
    null,
    true
  ),
  (
    'bbbb0002-0002-4002-8002-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'norte',
    'Norte B',
    null,
    true
  );

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('bbbb2222-2222-4222-8222-222222222222', 'bbbb0001-0001-4001-8001-000000000001'),
  ('bbbb4444-4444-4444-8444-444444444444', 'bbbb0002-0002-4002-8002-000000000002');

do $$
begin
  begin
    insert into public.sucursales (tienda_id, slug, nombre)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'extra', 'Extra A');
    raise exception 'el cupo de sucursales de basico no bloqueo';
  exception
    when others then
      if sqlerrm <> 'Has alcanzado el máximo de sucursales de tu plan' then
        raise exception 'mensaje de sucursales: %', sqlerrm;
      end if;
  end;

  update public.planes set max_usuarios = 1 where nombre = 'Básico';
  begin
    insert into public.miembros (user_id, tienda_id, rol)
    values (
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'vendedor'
    );
    raise exception 'el cupo de usuarios no bloqueo el insert';
  exception
    when others then
      if sqlerrm <> 'Has alcanzado el máximo de usuarios de tu plan' then
        raise exception 'mensaje de usuarios: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.miembro_sucursales (miembro_id, sucursal_id)
    values (
      'aaaa1111-1111-4111-8111-111111111111',
      'bbbb0001-0001-4001-8001-000000000001'
    );
    raise exception 'se cruzo personal de A con sucursal de B';
  exception
    when others then
      if sqlerrm <> 'La sucursal no pertenece a la tienda del personal.' then
        raise exception 'mensaje de cruce: %', sqlerrm;
      end if;
  end;
end
$$;

do $$
declare
  definidor boolean;
  config text[];
  n int;
begin
  select p.prosecdef, p.proconfig
    into definidor, config
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'tiene_acceso_sucursal';

  if definidor is not true or not (config @> array['search_path=public']) then
    raise exception 'tiene_acceso_sucursal no queda solo en el servidor: %', config;
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'tiene_acceso_sucursal'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE';

  if n <> 0 then
    raise exception 'authenticated puede ejecutar tiene_acceso_sucursal';
  end if;
end
$$;

do $$
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  if not public.tiene_acceso_sucursal(
    'aaaa0001-0001-4001-8001-000000000001',
    array['dueno']
  ) then
    raise exception 'el dueno no accede a su sucursal';
  end if;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  if public.tiene_acceso_sucursal(
    'bbbb0002-0002-4002-8002-000000000002',
    array['vendedor']
  ) then
    raise exception 'el vendedor accede a una sucursal no asignada';
  end if;
  if not public.tiene_acceso_sucursal(
    'bbbb0001-0001-4001-8001-000000000001',
    array['vendedor', 'gerente']
  ) then
    raise exception 'el vendedor no accede a su sucursal';
  end if;
  if public.tiene_acceso_sucursal(
    'aaaa0001-0001-4001-8001-000000000001',
    array['vendedor', 'dueno']
  ) then
    raise exception 'el vendedor de B accede a la sucursal de A';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  execute 'set local role authenticated';

  select count(*) into n from public.sucursales;
  if n <> 1 then
    raise exception 'Ana ve % sucursales; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.sucursales
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'Ana ve sucursales de B';
  end if;

  select count(*) into n from public.invitaciones;
  if n <> 0 then
    raise exception 'Ana ve invitaciones ajenas';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  execute 'set local role authenticated';

  select count(*) into n from public.sucursales;
  if n <> 1 then
    raise exception 'Bruno ve % sucursales; se esperaba 1', n;
  end if;

  select count(*) into n from public.invitaciones;
  if n <> 0 then
    raise exception 'el vendedor ve invitaciones';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  execute 'set local role authenticated';

  select count(*) into n from public.sucursales;
  if n <> 3 then
    raise exception 'super admin ve % sucursales; se esperaban 3', n;
  end if;
end
$$;

do $$
begin
  execute 'set local role anon';
  begin
    perform 1 from public.sucursales;
    raise exception 'anon pudo leer sucursales';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

rollback;
