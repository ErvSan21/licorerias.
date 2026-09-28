-- Módulo 2: sucursales, personal por sucursal e invitaciones.
-- Los cupos de sucursales y usuarios llaman a exigir_cupo_plan (módulo 1).

create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  slug text not null,
  nombre text not null,
  direccion text not null default '',
  telefono text,
  lat double precision,
  lng double precision,
  horario jsonb not null default '{}'::jsonb,
  abierta boolean not null default true,
  minutos_anticipacion_recojo integer not null default 30,
  acepta_delivery boolean not null default false,
  acepta_recojo boolean not null default true,
  activa boolean not null default true,
  orden integer not null default 0,
  constraint sucursales_slug_tienda_unico unique (tienda_id, slug),
  constraint sucursales_slug_valido check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint sucursales_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint sucursales_telefono_bo check (telefono is null or telefono ~ '^591[0-9]{8}$'),
  constraint sucursales_coordenadas check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  ),
  constraint sucursales_horario_objeto check (jsonb_typeof(horario) = 'object'),
  constraint sucursales_minutos_recojo check (
    minutos_anticipacion_recojo between 0 and 240
  )
);

create index sucursales_tienda_orden_idx on public.sucursales (tienda_id, orden, nombre);

create table public.miembro_sucursales (
  miembro_id uuid not null references public.miembros (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  primary key (miembro_id, sucursal_id)
);

create index miembro_sucursales_sucursal_idx on public.miembro_sucursales (sucursal_id);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  rol text not null,
  sucursales uuid[] not null default '{}',
  token text not null unique,
  expira timestamptz not null,
  creado_en timestamptz not null default now(),
  constraint invitaciones_rol_valido check (rol in ('dueno', 'gerente', 'vendedor')),
  constraint invitaciones_email_no_vacio check (length(btrim(email)) > 0),
  constraint invitaciones_token_no_vacio check (length(token) >= 20)
);

create index invitaciones_tienda_idx on public.invitaciones (tienda_id, creado_en desc);

alter table public.sucursales enable row level security;
alter table public.miembro_sucursales enable row level security;
alter table public.invitaciones enable row level security;

revoke all on table public.sucursales from public, anon, authenticated;
revoke all on table public.miembro_sucursales from public, anon, authenticated;
revoke all on table public.invitaciones from public, anon, authenticated;

grant select on table public.sucursales to authenticated;
grant select on table public.miembro_sucursales to authenticated;
grant select on table public.invitaciones to authenticated;

grant all on table public.sucursales to service_role;
grant all on table public.miembro_sucursales to service_role;
grant all on table public.invitaciones to service_role;

-- El dueño ve todas las sucursales de su tienda. Gerente y vendedor, solo las asignadas.
create policy sucursales_select on public.sucursales
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = sucursales.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = sucursales.id
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy miembro_sucursales_select on public.miembro_sucursales
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.id = miembro_sucursales.miembro_id
        and (
          m.user_id = (select auth.uid())
          or exists (
            select 1
            from public.miembros as dueno
            where dueno.tienda_id = m.tienda_id
              and dueno.user_id = (select auth.uid())
              and dueno.activo
              and dueno.rol = 'dueno'
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

-- Las invitaciones las ve el dueño. No el resto del personal.
create policy invitaciones_select on public.invitaciones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = invitaciones.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and m.rol = 'dueno'
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create or replace function public.tiene_acceso_sucursal(p_sucursal uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sucursales as s
    join public.miembros as m on m.tienda_id = s.tienda_id
    where s.id = p_sucursal
      and m.user_id = auth.uid()
      and m.activo
      and m.rol = any (p_roles)
      and (
        m.rol = 'dueno'
        or exists (
          select 1
          from public.miembro_sucursales as ms
          where ms.miembro_id = m.id
            and ms.sucursal_id = s.id
        )
      )
  );
$$;

create or replace function public.trg_cupo_usuarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.activo then
    perform public.exigir_cupo_plan(new.tienda_id, 'usuarios');
  elsif tg_op = 'UPDATE' and new.activo and not old.activo then
    perform public.exigir_cupo_plan(new.tienda_id, 'usuarios');
  end if;
  return new;
end;
$$;

create trigger miembros_cupo_plan
  before insert or update of activo on public.miembros
  for each row
  execute function public.trg_cupo_usuarios();

create or replace function public.trg_cupo_sucursales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.activa then
    perform public.exigir_cupo_plan(new.tienda_id, 'sucursales');
  elsif tg_op = 'UPDATE' and new.activa and not old.activa then
    perform public.exigir_cupo_plan(new.tienda_id, 'sucursales');
  end if;
  return new;
end;
$$;

create trigger sucursales_cupo_plan
  before insert or update of activa on public.sucursales
  for each row
  execute function public.trg_cupo_sucursales();

create or replace function public.trg_miembro_sucursal_misma_tienda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.miembros as m
    join public.sucursales as s on s.tienda_id = m.tienda_id
    where m.id = new.miembro_id
      and s.id = new.sucursal_id
  ) then
    raise exception 'La sucursal no pertenece a la tienda del personal.';
  end if;
  return new;
end;
$$;

create trigger miembro_sucursales_misma_tienda
  before insert or update on public.miembro_sucursales
  for each row
  execute function public.trg_miembro_sucursal_misma_tienda();

revoke all on function public.tiene_acceso_sucursal(uuid, text[]) from public, anon, authenticated;
revoke all on function public.trg_cupo_usuarios() from public, anon, authenticated;
revoke all on function public.trg_cupo_sucursales() from public, anon, authenticated;
revoke all on function public.trg_miembro_sucursal_misma_tienda() from public, anon, authenticated;

grant execute on function public.tiene_acceso_sucursal(uuid, text[]) to service_role;
grant execute on function public.trg_cupo_usuarios() to service_role;
grant execute on function public.trg_cupo_sucursales() to service_role;
grant execute on function public.trg_miembro_sucursal_misma_tienda() to service_role;
