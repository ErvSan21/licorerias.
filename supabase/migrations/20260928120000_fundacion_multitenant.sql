-- Módulo 0: tiendas, miembros, super admins y auditoría.
-- Requiere el esquema auth de Supabase (auth.users y auth.uid()).
-- Las funciones es_super_admin y tiene_rol_tienda son solo de servidor:
-- security definer, search_path fijo, sin execute para public, anon ni authenticated.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  estado text not null default 'activa',
  creado_en timestamptz not null default now(),
  constraint tiendas_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint tiendas_estado_valido check (estado in ('activa', 'suspendida', 'cancelada')),
  constraint tiendas_slug_formato check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  -- Misma lista que src/lib/tenant.ts (SLUGS_RESERVADOS).
  constraint tiendas_slug_no_reservado check (
    slug not in (
      'admin',
      'api',
      'app',
      'assets',
      'auth',
      'callback',
      'cuenta',
      'dashboard',
      'dev',
      'favicon',
      'fonts',
      'health',
      'icons',
      'images',
      'login',
      'logout',
      'manifest',
      'middleware',
      'offline',
      'panel',
      'proxy',
      'public',
      'registro',
      'robots',
      'service-worker',
      'signup',
      'sitemap',
      'static',
      'super',
      'supabase',
      'sw',
      't',
      'vercel',
      'www'
    )
  )
);

create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  rol text not null,
  activo boolean not null default true,
  constraint miembros_rol_valido check (rol in ('dueno', 'gerente', 'vendedor')),
  constraint miembros_usuario_tienda_unico unique (user_id, tienda_id)
);

create index miembros_tienda_id_idx on public.miembros (tienda_id);

create table public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references public.tiendas (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  constraint auditoria_accion_no_vacia check (length(btrim(accion)) > 0),
  constraint auditoria_detalle_objeto check (jsonb_typeof(detalle) = 'object')
);

create index auditoria_tienda_creado_idx
  on public.auditoria (tienda_id, creado_en desc);

alter table public.tiendas enable row level security;
alter table public.miembros enable row level security;
alter table public.super_admins enable row level security;
alter table public.auditoria enable row level security;

revoke all on table public.tiendas from public, anon, authenticated;
revoke all on table public.miembros from public, anon, authenticated;
revoke all on table public.super_admins from public, anon, authenticated;
revoke all on table public.auditoria from public, anon, authenticated;

grant select on table public.tiendas to authenticated;
grant select on table public.miembros to authenticated;
grant select on table public.super_admins to authenticated;
grant select on table public.auditoria to authenticated;

grant all on table public.tiendas to service_role;
grant all on table public.miembros to service_role;
grant all on table public.super_admins to service_role;
grant all on table public.auditoria to service_role;

-- El usuario solo ve sus propias filas de membresía (y el super admin, todas).
-- No consulta tiendas, para no recursar con la política de tiendas.
create policy miembros_select on public.miembros
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy tiendas_select on public.tiendas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = tiendas.id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy super_admins_select on public.super_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Auditoría de la tienda: cualquier miembro activo de esa tienda.
-- Filas sin tienda (login de plataforma): solo super admin.
create policy auditoria_select on public.auditoria
  for select
  to authenticated
  using (
    (
      tienda_id is not null
      and exists (
        select 1
        from public.miembros as m
        where m.tienda_id = auditoria.tienda_id
          and m.user_id = (select auth.uid())
          and m.activo
      )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create or replace function public.es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins as s
    where s.user_id = auth.uid()
  );
$$;

create or replace function public.tiene_rol_tienda(tienda_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.miembros as m
    where m.tienda_id = tiene_rol_tienda.tienda_id
      and m.user_id = auth.uid()
      and m.activo
      and m.rol = any (tiene_rol_tienda.roles)
  );
$$;

revoke all on function public.es_super_admin() from public;
revoke all on function public.es_super_admin() from anon;
revoke all on function public.es_super_admin() from authenticated;
grant execute on function public.es_super_admin() to service_role;

revoke all on function public.tiene_rol_tienda(uuid, text[]) from public;
revoke all on function public.tiene_rol_tienda(uuid, text[]) from anon;
revoke all on function public.tiene_rol_tienda(uuid, text[]) from authenticated;
grant execute on function public.tiene_rol_tienda(uuid, text[]) to service_role;
