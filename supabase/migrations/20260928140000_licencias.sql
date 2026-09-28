-- Módulo 1: planes, licencias y pagos manuales.
-- licencia_vigente, exigir_licencia_vigente, exigir_cupo_plan y
-- usuario_id_por_correo son solo de servidor: security definer,
-- search_path fijo, sin execute para public, anon ni authenticated.
-- Los triggers de cupo (sucursales, usuarios, productos) se agregan
-- en el módulo que crea cada tabla.

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio_mensual numeric(10, 2) not null,
  max_sucursales integer,
  max_productos integer,
  max_usuarios integer,
  funciones jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  constraint planes_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint planes_nombre_unico unique (nombre),
  constraint planes_precio_no_negativo check (precio_mensual >= 0),
  constraint planes_max_sucursales check (max_sucursales is null or max_sucursales > 0),
  constraint planes_max_productos check (max_productos is null or max_productos > 0),
  constraint planes_max_usuarios check (max_usuarios is null or max_usuarios > 0),
  constraint planes_funciones_objeto check (jsonb_typeof(funciones) = 'object')
);

-- Básico: 1 sucursal. Pro: 3. Cadena: límites nulos = ilimitado.
insert into public.planes (
  nombre,
  precio_mensual,
  max_sucursales,
  max_productos,
  max_usuarios,
  funciones
)
values
  (
    'Básico',
    149.00,
    1,
    200,
    5,
    '{"sucursales":1,"productos":200,"usuarios":5}'::jsonb
  ),
  (
    'Pro',
    349.00,
    3,
    1000,
    15,
    '{"sucursales":3,"productos":1000,"usuarios":15}'::jsonb
  ),
  (
    'Cadena',
    699.00,
    null,
    null,
    null,
    '{"sucursales":null,"productos":null,"usuarios":null}'::jsonb
  );

create table public.licencias (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null unique references public.tiendas (id) on delete cascade,
  plan_id uuid not null references public.planes (id) on delete restrict,
  estado text not null,
  inicio date not null,
  vence date not null,
  dias_gracia integer not null default 3,
  notas text,
  constraint licencias_estado_valido check (
    estado in ('prueba', 'activa', 'vencida', 'suspendida')
  ),
  constraint licencias_fechas check (vence >= inicio),
  constraint licencias_gracia_no_negativa check (dias_gracia >= 0)
);

create index licencias_vence_idx on public.licencias (vence);

create table public.pagos_licencia (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete restrict,
  monto numeric(10, 2) not null,
  fecha date not null,
  metodo text not null,
  referencia text,
  periodo_desde date not null,
  periodo_hasta date not null,
  registrado_por uuid not null references auth.users (id) on delete restrict,
  constraint pagos_monto_no_negativo check (monto >= 0),
  constraint pagos_metodo_valido check (metodo in ('qr', 'transferencia')),
  constraint pagos_periodo check (periodo_hasta >= periodo_desde),
  constraint pagos_referencia_longitud check (
    referencia is null or length(btrim(referencia)) > 0
  )
);

create index pagos_licencia_tienda_fecha_idx
  on public.pagos_licencia (tienda_id, fecha desc);

alter table public.planes enable row level security;
alter table public.licencias enable row level security;
alter table public.pagos_licencia enable row level security;

revoke all on table public.planes from public, anon, authenticated;
revoke all on table public.licencias from public, anon, authenticated;
revoke all on table public.pagos_licencia from public, anon, authenticated;

grant select on table public.planes to authenticated;
grant select on table public.licencias to authenticated;
grant select on table public.pagos_licencia to authenticated;

grant all on table public.planes to service_role;
grant all on table public.licencias to service_role;
grant all on table public.pagos_licencia to service_role;

create policy planes_select on public.planes
  for select
  to authenticated
  using (true);

create policy licencias_select on public.licencias
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = licencias.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy pagos_licencia_select on public.pagos_licencia
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create or replace function public.licencia_vigente(p_tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiendas as t
    join public.licencias as l on l.tienda_id = t.id
    where t.id = p_tienda
      and t.estado = 'activa'
      and l.estado in ('prueba', 'activa')
      and (now() at time zone 'America/La_Paz')::date
        <= (l.vence + l.dias_gracia)
  );
$$;

create or replace function public.exigir_licencia_vigente(p_tienda uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.licencia_vigente(p_tienda) then
    raise exception 'Tienda no disponible.';
  end if;
end;
$$;

-- La llama el servidor y, en módulos posteriores, el trigger de cada tabla.
-- Cuenta filas ya guardadas: un insert nuevo debe llamarla antes de insertar.
create or replace function public.exigir_cupo_plan(p_tienda uuid, p_recurso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_suc integer;
  max_pro integer;
  max_usu integer;
  maximo integer;
  actual integer;
  etiqueta text;
begin
  if p_recurso not in ('sucursales', 'productos', 'usuarios') then
    raise exception 'Recurso de plan desconocido.';
  end if;

  select p.max_sucursales, p.max_productos, p.max_usuarios
    into max_suc, max_pro, max_usu
  from public.licencias as l
  join public.planes as p on p.id = l.plan_id
  where l.tienda_id = p_tienda;

  if not found then
    raise exception 'La tienda no tiene licencia.';
  end if;

  if p_recurso = 'sucursales' then
    maximo := max_suc;
    etiqueta := 'sucursales';
  elsif p_recurso = 'productos' then
    maximo := max_pro;
    etiqueta := 'productos';
  else
    maximo := max_usu;
    etiqueta := 'usuarios';
  end if;

  if maximo is null then
    return;
  end if;

  if p_recurso = 'usuarios' then
    select count(*)::integer
      into actual
    from public.miembros
    where tienda_id = p_tienda
      and activo;
  elsif p_recurso = 'sucursales' then
    if to_regclass('public.sucursales') is null then
      return;
    end if;
    execute
      'select count(*)::integer from public.sucursales where tienda_id = $1 and activa'
      into actual
      using p_tienda;
  else
    if to_regclass('public.productos') is null then
      return;
    end if;
    execute
      'select count(*)::integer from public.productos where tienda_id = $1 and activo'
      into actual
      using p_tienda;
  end if;

  if actual >= maximo then
    raise exception 'Has alcanzado el máximo de % de tu plan', etiqueta;
  end if;
end;
$$;

create or replace function public.usuario_id_por_correo(p_correo text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users as u
  where lower(u.email) = lower(btrim(p_correo))
  limit 1;
$$;

revoke all on function public.licencia_vigente(uuid) from public, anon, authenticated;
revoke all on function public.exigir_licencia_vigente(uuid) from public, anon, authenticated;
revoke all on function public.exigir_cupo_plan(uuid, text) from public, anon, authenticated;
revoke all on function public.usuario_id_por_correo(text) from public, anon, authenticated;

grant execute on function public.licencia_vigente(uuid) to service_role;
grant execute on function public.exigir_licencia_vigente(uuid) to service_role;
grant execute on function public.exigir_cupo_plan(uuid, text) to service_role;
grant execute on function public.usuario_id_por_correo(text) to service_role;
