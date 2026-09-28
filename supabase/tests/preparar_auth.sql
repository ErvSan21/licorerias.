-- Stub mínimo de auth para correr el aislamiento en Postgres local.
-- En Supabase este esquema ya existe: no apliques este archivo ahí.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
declare
  sub text;
  claims text;
begin
  sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  if sub is not null then
    return sub::uuid;
  end if;

  claims := nullif(current_setting('request.jwt.claims', true), '');
  if claims is null then
    return null;
  end if;

  sub := claims::jsonb ->> 'sub';
  if sub is null or sub = '' then
    return null;
  end if;
  return sub::uuid;
end;
$$;
