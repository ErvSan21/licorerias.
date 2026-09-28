-- Dos tiendas de ejemplo. Un usuario de A no ve nada de B.
-- Corre dentro de una transacción y hace rollback.
-- Uso: bash scripts/probar-aislamiento.sh

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

insert into public.auditoria (tienda_id, user_id, accion, detalle) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'ejemplo.alta',
    '{"tienda":"A"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'ejemplo.alta',
    '{"tienda":"B"}'::jsonb
  ),
  (
    null,
    '33333333-3333-4333-8333-333333333333',
    'ejemplo.plataforma',
    '{}'::jsonb
  );

do $$
begin
  begin
    insert into public.tiendas (slug, nombre) values ('admin', 'Reservada');
    raise exception 'el slug reservado admin fue aceptado';
  exception
    when check_violation then
      null;
  end;
end
$$;

do $$
declare
  n int;
  definidor boolean;
  config text[];
begin
  select p.prosecdef, p.proconfig
    into definidor, config
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'es_super_admin';

  if definidor is not true then
    raise exception 'es_super_admin no es security definer';
  end if;
  if not (config @> array['search_path=public']) then
    raise exception 'search_path de es_super_admin: %', config;
  end if;

  select p.prosecdef, p.proconfig
    into definidor, config
  from pg_proc as p
  join pg_namespace as ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'tiene_rol_tienda';

  if definidor is not true then
    raise exception 'tiene_rol_tienda no es security definer';
  end if;
  if not (config @> array['search_path=public']) then
    raise exception 'search_path de tiene_rol_tienda: %', config;
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name in ('es_super_admin', 'tiene_rol_tienda')
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE';

  if n <> 0 then
    raise exception 'execute concedido a public, anon o authenticated (% filas)', n;
  end if;

  if not has_function_privilege('service_role', 'public.es_super_admin()', 'EXECUTE') then
    raise exception 'service_role no puede ejecutar es_super_admin';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.tiene_rol_tienda(uuid, text[])',
    'EXECUTE'
  ) then
    raise exception 'service_role no puede ejecutar tiene_rol_tienda';
  end if;
end
$$;

-- Usuario de la tienda A.
do $$
declare
  n int;
  slug text;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.tiendas;
  if n <> 1 then
    raise exception 'Ana ve % tiendas; se esperaba 1', n;
  end if;

  select t.slug into slug from public.tiendas as t;
  if slug <> 'esquina-a' then
    raise exception 'Ana ve la tienda %', slug;
  end if;

  select count(*) into n
  from public.tiendas
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'Ana ve la tienda B por id';
  end if;

  select count(*) into n from public.miembros;
  if n <> 1 then
    raise exception 'Ana ve % miembros; se esperaba solo el suyo', n;
  end if;

  select count(*) into n
  from public.miembros
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then
    raise exception 'Ana ve miembros de B';
  end if;

  select count(*) into n from public.auditoria;
  if n <> 1 then
    raise exception 'Ana ve % filas de auditoria; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.auditoria
  where tienda_id is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if n <> 0 then
    raise exception 'Ana ve auditoria que no es de A';
  end if;

  select count(*) into n from public.super_admins;
  if n <> 0 then
    raise exception 'Ana ve super admins';
  end if;

  begin
    update public.tiendas
    set nombre = 'robada'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    if found then
      raise exception 'Ana pudo modificar la tienda B';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.miembros (user_id, tienda_id, rol)
    values (
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'dueno'
    );
    raise exception 'Ana pudo insertar una membresía en B';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.es_super_admin();
    raise exception 'authenticated pudo ejecutar es_super_admin';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.tiene_rol_tienda(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      array['dueno']
    );
    raise exception 'authenticated pudo ejecutar tiene_rol_tienda';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- Usuario de la tienda B.
do $$
declare
  n int;
  slug text;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.tiendas;
  if n <> 1 then
    raise exception 'Bruno ve % tiendas; se esperaba 1', n;
  end if;

  select t.slug into slug from public.tiendas as t;
  if slug <> 'barril-b' then
    raise exception 'Bruno ve la tienda %', slug;
  end if;

  select count(*) into n from public.auditoria;
  if n <> 1 then
    raise exception 'Bruno ve % filas de auditoria; se esperaba 1', n;
  end if;

  select count(*) into n
  from public.auditoria
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if n <> 0 then
    raise exception 'Bruno ve auditoria de A';
  end if;
end
$$;

-- Super admin ve ambas tiendas y la auditoría de plataforma.
do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.tiendas;
  if n <> 2 then
    raise exception 'super admin ve % tiendas; se esperaban 2', n;
  end if;

  select count(*) into n from public.miembros;
  if n <> 2 then
    raise exception 'super admin ve % miembros; se esperaban 2', n;
  end if;

  select count(*) into n from public.auditoria;
  if n <> 3 then
    raise exception 'super admin ve % auditorias; se esperaban 3', n;
  end if;
end
$$;

-- anon no tiene grant de lectura.
do $$
begin
  execute 'set local role anon';
  begin
    perform 1 from public.tiendas;
    raise exception 'anon pudo leer tiendas';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- service_role se salta RLS: por eso el servidor no puede fiarse solo de la base.
do $$
declare
  n int;
begin
  execute 'set local role service_role';
  select count(*) into n from public.tiendas;
  if n <> 2 then
    raise exception 'service_role ve % tiendas; se esperaban 2 (bypass RLS)', n;
  end if;
end
$$;

-- Helpers de servidor, con el jwt del usuario (no vía el rol authenticated).
do $$
declare
  ok boolean;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

  select public.tiene_rol_tienda(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['dueno']
  ) into ok;
  if ok is not true then
    raise exception 'Ana deberia tener rol dueno en A';
  end if;

  select public.tiene_rol_tienda(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['vendedor']
  ) into ok;
  if ok is true then
    raise exception 'Ana no es vendedora en A';
  end if;

  select public.tiene_rol_tienda(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    array['dueno', 'gerente', 'vendedor']
  ) into ok;
  if ok is true then
    raise exception 'Ana no tiene rol en B';
  end if;

  select public.es_super_admin() into ok;
  if ok is true then
    raise exception 'Ana no es super admin';
  end if;

  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  select public.es_super_admin() into ok;
  if ok is not true then
    raise exception 'el super admin no fue reconocido';
  end if;

  update public.miembros
  set activo = false
  where user_id = '11111111-1111-4111-8111-111111111111';

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  select public.tiene_rol_tienda(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['dueno']
  ) into ok;
  if ok is true then
    raise exception 'un miembro inactivo sigue teniendo rol';
  end if;
end
$$;

do $$
declare
  n int;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  execute 'set local role authenticated';
  select count(*) into n from public.tiendas;
  if n <> 0 then
    raise exception 'un miembro inactivo sigue viendo % tiendas', n;
  end if;
end
$$;

reset role;

do $$
declare
  n int;
  actual text;
begin
  select nombre into actual
  from public.tiendas
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if actual is distinct from 'Barril B' then
    raise exception 'la tienda B cambio de nombre: %', actual;
  end if;

  select count(*) into n from public.tiendas;
  if n <> 2 then
    raise exception 'el dueno de la sesion ve % tiendas', n;
  end if;
end
$$;

rollback;
