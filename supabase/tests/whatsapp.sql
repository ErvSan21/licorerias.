-- Credenciales y conversaciones: sin políticas y sin lectura anónima.
-- Corre dentro de una transacción y hace rollback.

begin;

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

insert into public.sucursales (
  id, tienda_id, slug, nombre, lat, lng, abierta, acepta_delivery, acepta_recojo, activa, horario
) values (
  'aaaa0001-0001-4001-8001-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'centro',
  'Centro A',
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
  n integer;
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname = 'credenciales_whatsapp'
  ) or not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname = 'conversaciones'
  ) then
    raise exception 'WhatsApp quedó sin RLS';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('credenciales_whatsapp', 'conversaciones')
  ) then
    raise exception 'WhatsApp tiene políticas de lectura';
  end if;

  insert into public.credenciales_whatsapp (
    tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    null,
    '111111',
    '222222',
    'cifrado-de-prueba-largo',
    'argo'
  );

  insert into public.credenciales_whatsapp (
    tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaa0001-0001-4001-8001-000000000001',
    '333333',
    '444444',
    'cifrado-de-sucursal-largo',
    'sal.'
  );

  begin
    insert into public.credenciales_whatsapp (
      tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      null,
      '555555',
      '666666',
      'otro-cifrado-de-tienda',
      'enda'
    );
    raise exception 'la tienda aceptó dos números propios';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.credenciales_whatsapp (
      tienda_id, phone_number_id, waba_id, token_cifrado, token_ultimos
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '333333',
      '777777',
      'cifrado-repetido-largo',
      'rido'
    );
    raise exception 'el mismo phone number id se registró dos veces';
  exception
    when unique_violation then
      null;
  end;

  begin
    execute 'set local role anon';
    select count(*) into n from public.credenciales_whatsapp;
    raise exception 'anon leyó % credenciales', n;
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  begin
    execute 'set local role authenticated';
    select count(*) into n from public.conversaciones;
    raise exception 'authenticated leyó % conversaciones', n;
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;
end
$$;

rollback;
