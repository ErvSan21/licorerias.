-- Vigencia, cupo y aislamiento de licencias.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'ana@esquina.test'),
  ('22222222-2222-4222-8222-222222222222', 'bruno@barril.test'),
  ('33333333-3333-4333-8333-333333333333', 'super@plataforma.test');

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B');

insert into public.miembros (user_id, tienda_id, rol) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dueno'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'vendedor');

insert into public.super_admins (user_id) values
  ('33333333-3333-4333-8333-333333333333');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  id,
  'prueba',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 14,
  3
from public.planes
where nombre = 'Básico';

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  id,
  'activa',
  (now() at time zone 'America/La_Paz')::date - 10,
  (now() at time zone 'America/La_Paz')::date + 20,
  0
from public.planes
where nombre = 'Pro';

do $$
declare
  definidor boolean;
  config text[];
  n int;
begin
  if not public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'la prueba de A deberia estar vigente';
  end if;
  if not public.licencia_vigente('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'la licencia de B deberia estar vigente';
  end if;

  update public.licencias
  set inicio = (now() at time zone 'America/La_Paz')::date - 10,
      vence = (now() at time zone 'America/La_Paz')::date - 2,
      dias_gracia = 3,
      estado = 'activa'
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if not public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'A sigue dentro de los dias de gracia';
  end if;

  update public.licencias
  set vence = (now() at time zone 'America/La_Paz')::date - 4
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'A ya paso la gracia';
  end if;

  update public.licencias
  set estado = 'suspendida',
      vence = (now() at time zone 'America/La_Paz')::date + 10
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'una licencia suspendida no esta vigente';
  end if;

  update public.licencias
  set estado = 'activa'
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  update public.tiendas
  set estado = 'suspendida'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'una tienda suspendida no esta vigente';
  end if;

  begin
    perform public.exigir_licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'exigir_licencia_vigente no bloqueo';
  exception
    when others then
      if sqlerrm <> 'Tienda no disponible.' then
        raise exception 'mensaje inesperado: %', sqlerrm;
      end if;
  end;

  update public.tiendas set estado = 'activa' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  update public.licencias
  set estado = 'prueba',
      vence = (now() at time zone 'America/La_Paz')::date + 14
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  perform public.exigir_licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

  update public.planes set max_usuarios = 1 where nombre = 'Básico';
  begin
    perform public.exigir_cupo_plan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'usuarios');
    raise exception 'el cupo de usuarios no bloqueo';
  exception
    when others then
      if sqlerrm <> 'Has alcanzado el máximo de usuarios de tu plan' then
        raise exception 'mensaje de cupo: %', sqlerrm;
      end if;
  end;

  perform public.exigir_cupo_plan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sucursales');
  perform public.exigir_cupo_plan('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'productos');

  if public.usuario_id_por_correo(' ANA@esquina.test ')
    is distinct from '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'no normalizo el correo';
  end if;

  if public.usuario_id_por_correo('ana@esquina.test')
    is distinct from '11111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'no encontro el usuario por correo';
  end if;
  if public.usuario_id_por_correo('nadie@test') is not null then
    raise exception 'encontro un correo que no existe';
  end if;

  select p.prosecdef, p.proconfig
    into definidor, config
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'licencia_vigente';

  if definidor is not true or not (config @> array['search_path=public']) then
    raise exception 'licencia_vigente no queda solo en el servidor: %', config;
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name in (
      'licencia_vigente',
      'exigir_licencia_vigente',
      'exigir_cupo_plan',
      'usuario_id_por_correo'
    )
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE';

  if n <> 0 then
    raise exception 'execute de licencias concedido a public, anon o authenticated (% filas)', n;
  end if;
end
$$;

insert into public.pagos_licencia (
  tienda_id,
  monto,
  fecha,
  metodo,
  referencia,
  periodo_desde,
  periodo_hasta,
  registrado_por
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  149.00,
  (now() at time zone 'America/La_Paz')::date,
  'qr',
  'op-1',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  '33333333-3333-4333-8333-333333333333'
);

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  execute 'set local role authenticated';

  select count(*) into n from public.licencias;
  if n <> 1 then
    raise exception 'Ana ve % licencias; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.licencias
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'Ana ve la licencia de B';
  end if;

  select count(*) into n from public.pagos_licencia;
  if n <> 0 then
    raise exception 'Ana ve pagos de licencia';
  end if;

  select count(*) into n from public.planes;
  if n < 3 then
    raise exception 'Ana no ve los planes de la plataforma';
  end if;

  begin
    perform public.licencia_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'authenticated pudo ejecutar licencia_vigente';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  execute 'set local role authenticated';

  select count(*) into n from public.licencias;
  if n <> 2 then
    raise exception 'super admin ve % licencias; se esperaban 2', n;
  end if;

  select count(*) into n from public.pagos_licencia;
  if n <> 1 then
    raise exception 'super admin ve % pagos; se esperaba 1', n;
  end if;
end
$$;

do $$
begin
  execute 'set local role anon';
  begin
    perform 1 from public.licencias;
    raise exception 'anon pudo leer licencias';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

rollback;
