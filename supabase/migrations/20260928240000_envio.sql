-- Tarifas por kilómetro y zonas circulares. El costo lo calcula el servidor.

create table public.tarifas_envio (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  hasta_km numeric(4, 1) not null,
  costo numeric(10, 2) not null,
  creado_en timestamptz not null default now(),
  constraint tarifas_hasta_km check (hasta_km > 0 and hasta_km <= 999.9),
  constraint tarifas_costo check (costo >= 0),
  constraint tarifas_rango_unico unique (sucursal_id, hasta_km)
);

create index tarifas_envio_sucursal_idx on public.tarifas_envio (sucursal_id, hasta_km);

create table public.zonas_reparto (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  nombre text not null,
  lat_centro double precision not null,
  lng_centro double precision not null,
  radio_km numeric(4, 1) not null,
  tipo text not null,
  costo numeric(10, 2),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint zonas_nombre check (length(btrim(nombre)) >= 2),
  constraint zonas_radio check (radio_km > 0 and radio_km <= 999.9),
  constraint zonas_tipo check (tipo in ('tarifa_fija', 'bloqueada')),
  constraint zonas_costo check (
    (tipo = 'tarifa_fija' and costo is not null and costo >= 0)
    or (tipo = 'bloqueada' and costo is null)
  ),
  constraint zonas_coordenadas check (
    lat_centro between -90 and 90
    and lng_centro between -180 and 180
  )
);

create index zonas_reparto_sucursal_idx on public.zonas_reparto (sucursal_id) where activa;

alter table public.tarifas_envio enable row level security;
alter table public.zonas_reparto enable row level security;

revoke all on table public.tarifas_envio from public, anon, authenticated;
revoke all on table public.zonas_reparto from public, anon, authenticated;

grant select on table public.tarifas_envio to authenticated;
grant select on table public.zonas_reparto to authenticated;

grant all on table public.tarifas_envio to service_role;
grant all on table public.zonas_reparto to service_role;

create policy tarifas_envio_select on public.tarifas_envio
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = tarifas_envio.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = tarifas_envio.sucursal_id
          )
        )
    )
    or exists (
      select 1 from public.super_admins as s where s.user_id = (select auth.uid())
    )
  );

create policy zonas_reparto_select on public.zonas_reparto
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = zonas_reparto.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = zonas_reparto.sucursal_id
          )
        )
    )
    or exists (
      select 1 from public.super_admins as s where s.user_id = (select auth.uid())
    )
  );

create or replace function public.guardar_tarifa(
  p_tienda uuid,
  p_tarifa uuid,
  p_sucursal uuid,
  p_hasta_km numeric,
  p_costo numeric,
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  n integer;
  rango numeric(4, 1);
begin
  if p_hasta_km is null or p_hasta_km <= 0 or p_hasta_km > 999.9 then
    raise exception 'El rango en kilómetros no es válido.';
  end if;
  if p_costo is null or p_costo < 0 then
    raise exception 'El costo no puede ser negativo.';
  end if;
  rango := round(p_hasta_km, 1);

  select count(*) into n
  from public.sucursales as s
  where s.id = p_sucursal
    and s.tienda_id = p_tienda;
  if n <> 1 then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  select count(*) into n
  from public.tarifas_envio as t
  where t.sucursal_id = p_sucursal
    and t.hasta_km = rango
    and (p_tarifa is null or t.id <> p_tarifa);
  if n > 0 then
    raise exception 'Ese rango ya existe.';
  end if;

  if p_tarifa is null then
    insert into public.tarifas_envio (tienda_id, sucursal_id, hasta_km, costo)
    values (p_tienda, p_sucursal, rango, round(p_costo, 2))
    returning id into nuevo;
    return nuevo;
  end if;

  update public.tarifas_envio
  set sucursal_id = p_sucursal,
      hasta_km = rango,
      costo = round(p_costo, 2)
  where id = p_tarifa
    and tienda_id = p_tienda;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Tarifa no encontrada.';
  end if;
  return p_tarifa;
end;
$$;

create or replace function public.eliminar_tarifa(p_tienda uuid, p_tarifa uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.tarifas_envio
  where id = p_tarifa
    and tienda_id = p_tienda;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Tarifa no encontrada.';
  end if;
end;
$$;

create or replace function public.guardar_zona(
  p_tienda uuid,
  p_zona uuid,
  p_sucursal uuid,
  p_nombre text,
  p_lat double precision,
  p_lng double precision,
  p_radio numeric,
  p_tipo text,
  p_costo numeric,
  p_activa boolean,
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  n integer;
  costo numeric(10, 2);
begin
  if length(btrim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre de la zona.';
  end if;
  if p_tipo not in ('tarifa_fija', 'bloqueada') then
    raise exception 'El tipo de zona no es válido.';
  end if;
  if p_radio is null or p_radio <= 0 or p_radio > 999.9 then
    raise exception 'El radio no es válido.';
  end if;
  if p_lat is null or p_lat < -90 or p_lat > 90 or p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception 'La latitud tiene que estar entre -90 y 90.';
  end if;
  if p_tipo = 'bloqueada' then
    costo := null;
  elsif p_costo is null or p_costo < 0 then
    raise exception 'El costo no puede ser negativo.';
  else
    costo := round(p_costo, 2);
  end if;

  select count(*) into n
  from public.sucursales as s
  where s.id = p_sucursal
    and s.tienda_id = p_tienda;
  if n <> 1 then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  if p_zona is null then
    insert into public.zonas_reparto (
      tienda_id, sucursal_id, nombre, lat_centro, lng_centro, radio_km, tipo, costo, activa
    )
    values (
      p_tienda,
      p_sucursal,
      btrim(p_nombre),
      p_lat,
      p_lng,
      round(p_radio, 1),
      p_tipo,
      costo,
      coalesce(p_activa, true)
    )
    returning id into nuevo;
    return nuevo;
  end if;

  update public.zonas_reparto
  set sucursal_id = p_sucursal,
      nombre = btrim(p_nombre),
      lat_centro = p_lat,
      lng_centro = p_lng,
      radio_km = round(p_radio, 1),
      tipo = p_tipo,
      costo = costo,
      activa = coalesce(p_activa, true)
  where id = p_zona
    and tienda_id = p_tienda;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Zona no encontrada.';
  end if;
  return p_zona;
end;
$$;

create or replace function public.eliminar_zona(p_tienda uuid, p_zona uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.zonas_reparto
  where id = p_zona
    and tienda_id = p_tienda;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Zona no encontrada.';
  end if;
end;
$$;

revoke all on function public.guardar_tarifa(uuid, uuid, uuid, numeric, numeric, uuid) from public, anon, authenticated;
revoke all on function public.eliminar_tarifa(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.guardar_zona(uuid, uuid, uuid, text, double precision, double precision, numeric, text, numeric, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.eliminar_zona(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.guardar_tarifa(uuid, uuid, uuid, numeric, numeric, uuid) to service_role;
grant execute on function public.eliminar_tarifa(uuid, uuid, uuid) to service_role;
grant execute on function public.guardar_zona(uuid, uuid, uuid, text, double precision, double precision, numeric, text, numeric, boolean, uuid) to service_role;
grant execute on function public.eliminar_zona(uuid, uuid, uuid) to service_role;
