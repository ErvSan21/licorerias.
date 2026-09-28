-- Ofertas y colecciones. El precio cobrado sale de precio_vigente.

create table public.ofertas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  sucursal_id uuid references public.sucursales (id) on delete cascade,
  tipo text not null,
  valor numeric(10, 2) not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint ofertas_tipo_valido check (tipo in ('precio_fijo', 'porcentaje')),
  constraint ofertas_valor_no_negativo check (valor >= 0),
  constraint ofertas_porcentaje_tope check (tipo <> 'porcentaje' or valor <= 100),
  constraint ofertas_fijo_con_sucursal check (tipo <> 'precio_fijo' or sucursal_id is not null),
  constraint ofertas_rango check (fin > inicio)
);

create index ofertas_producto_idx on public.ofertas (producto_id, sucursal_id, inicio, fin);

create table public.colecciones (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  nombre text not null,
  descripcion text,
  imagen_url text,
  inicio timestamptz not null,
  fin timestamptz not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint colecciones_nombre check (length(btrim(nombre)) >= 2),
  constraint colecciones_rango check (fin > inicio)
);

create index colecciones_tienda_idx on public.colecciones (tienda_id, inicio, fin);

create table public.coleccion_productos (
  coleccion_id uuid not null references public.colecciones (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  orden integer not null default 0,
  primary key (coleccion_id, producto_id)
);

create index coleccion_productos_producto_idx on public.coleccion_productos (producto_id);

alter table public.ofertas enable row level security;
alter table public.colecciones enable row level security;
alter table public.coleccion_productos enable row level security;

revoke all on table public.ofertas from public, anon, authenticated;
revoke all on table public.colecciones from public, anon, authenticated;
revoke all on table public.coleccion_productos from public, anon, authenticated;

grant select on table public.ofertas to authenticated;
grant select on table public.colecciones to authenticated;
grant select on table public.coleccion_productos to authenticated;

grant all on table public.ofertas to service_role;
grant all on table public.colecciones to service_role;
grant all on table public.coleccion_productos to service_role;

create policy ofertas_select on public.ofertas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = ofertas.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or ofertas.sucursal_id is null
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = ofertas.sucursal_id
          )
        )
    )
    or exists (
      select 1 from public.super_admins as s where s.user_id = (select auth.uid())
    )
  );

create policy colecciones_select on public.colecciones
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = colecciones.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1 from public.super_admins as s where s.user_id = (select auth.uid())
    )
  );

create policy coleccion_productos_select on public.coleccion_productos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = coleccion_productos.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1 from public.super_admins as s where s.user_id = (select auth.uid())
    )
  );

-- Parte de precio_base y aplica la oferta vigente de menor precio final.
create or replace function public.precio_vigente(p_producto uuid, p_sucursal uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base numeric(10, 2);
  origen text;
  mejor numeric(10, 2);
  candidato numeric(10, 2);
  oferta record;
begin
  base := public.precio_base(p_producto, p_sucursal);
  if base is null then
    return null;
  end if;

  select case
    when ps.usa_precio_central or not coalesce(c.sucursales_pueden_fijar_precio, true)
      then 'central'
    else 'propio'
  end
  into origen
  from public.producto_sucursal as ps
  left join public.configuracion_tienda as c on c.tienda_id = ps.tienda_id
  where ps.producto_id = p_producto
    and ps.sucursal_id = p_sucursal;

  mejor := base;

  for oferta in
    select o.tipo, o.valor
    from public.ofertas as o
    join public.producto_sucursal as ps
      on ps.producto_id = o.producto_id
     and ps.sucursal_id = p_sucursal
     and ps.tienda_id = o.tienda_id
    where o.producto_id = p_producto
      and o.activa
      and now() >= o.inicio
      and now() < o.fin
      and (o.sucursal_id is null or o.sucursal_id = p_sucursal)
      and (o.tipo = 'porcentaje' or o.sucursal_id = p_sucursal)
  loop
    if oferta.tipo = 'porcentaje' then
      candidato := round(base * (100 - oferta.valor) / 100, 2);
    else
      candidato := round(oferta.valor, 2);
    end if;
    if candidato < mejor then
      mejor := candidato;
    end if;
  end loop;

  if mejor < 0 then
    mejor := 0;
  end if;

  return jsonb_build_object(
    'precio_original', base,
    'precio_final', mejor,
    'origen_precio', case when mejor < base then 'oferta' else origen end
  );
end;
$$;

create or replace function public.guardar_oferta(
  p_tienda uuid,
  p_oferta uuid,
  p_producto uuid,
  p_sucursal uuid,
  p_tipo text,
  p_valor numeric,
  p_inicio timestamptz,
  p_fin timestamptz,
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
  tienda_producto uuid;
  n integer;
begin
  if p_tipo not in ('precio_fijo', 'porcentaje') then
    raise exception 'El tipo de oferta no es válido.';
  end if;
  if p_tipo = 'precio_fijo' and p_sucursal is null then
    raise exception 'El precio fijo es de una sucursal.';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'El valor de la oferta no puede ser negativo.';
  end if;
  if p_tipo = 'porcentaje' and p_valor > 100 then
    raise exception 'El porcentaje no puede pasar de 100.';
  end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'La fecha de fin tiene que ser posterior al inicio.';
  end if;

  select p.tienda_id into tienda_producto
  from public.productos as p
  where p.id = p_producto;
  if tienda_producto is null or tienda_producto <> p_tienda then
    raise exception 'El producto no pertenece a la tienda.';
  end if;

  if p_sucursal is not null then
    select count(*) into n
    from public.sucursales as s
    where s.id = p_sucursal
      and s.tienda_id = p_tienda;
    if n <> 1 then
      raise exception 'La sucursal no pertenece a la tienda.';
    end if;
    select count(*) into n
    from public.producto_sucursal as ps
    where ps.producto_id = p_producto
      and ps.sucursal_id = p_sucursal
      and ps.tienda_id = p_tienda;
    if n <> 1 then
      raise exception 'El producto no se ofrece en esa sucursal.';
    end if;
  end if;

  if p_oferta is null then
    insert into public.ofertas (
      tienda_id, producto_id, sucursal_id, tipo, valor, inicio, fin, activa
    )
    values (
      p_tienda, p_producto, p_sucursal, p_tipo, round(p_valor, 2), p_inicio, p_fin, coalesce(p_activa, true)
    )
    returning id into nuevo;
    return nuevo;
  end if;

  update public.ofertas
  set producto_id = p_producto,
      sucursal_id = p_sucursal,
      tipo = p_tipo,
      valor = round(p_valor, 2),
      inicio = p_inicio,
      fin = p_fin,
      activa = coalesce(p_activa, true)
  where id = p_oferta
    and tienda_id = p_tienda;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Oferta no encontrada.';
  end if;
  return p_oferta;
end;
$$;

create or replace function public.guardar_coleccion(
  p_tienda uuid,
  p_coleccion uuid,
  p_nombre text,
  p_descripcion text,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_activa boolean,
  p_productos uuid[],
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  esperados integer;
  encontrados integer;
begin
  if length(btrim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre de la colección.';
  end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'La fecha de fin tiene que ser posterior al inicio.';
  end if;

  select count(distinct valor)::integer
  into esperados
  from unnest(coalesce(p_productos, '{}'::uuid[])) as lista(valor);

  select count(*)
  into encontrados
  from public.productos as p
  where p.tienda_id = p_tienda
    and p.id = any(coalesce(p_productos, '{}'::uuid[]));

  if encontrados <> esperados then
    raise exception 'El producto no pertenece a la tienda.';
  end if;

  if p_coleccion is null then
    insert into public.colecciones (tienda_id, nombre, descripcion, inicio, fin, activa)
    values (
      p_tienda,
      btrim(p_nombre),
      nullif(btrim(coalesce(p_descripcion, '')), ''),
      p_inicio,
      p_fin,
      coalesce(p_activa, true)
    )
    returning id into nuevo;
  else
    update public.colecciones
    set nombre = btrim(p_nombre),
        descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
        inicio = p_inicio,
        fin = p_fin,
        activa = coalesce(p_activa, true)
    where id = p_coleccion
      and tienda_id = p_tienda;
    if not found then
      raise exception 'Colección no encontrada.';
    end if;
    nuevo := p_coleccion;
    delete from public.coleccion_productos
    where coleccion_id = nuevo
      and tienda_id = p_tienda;
  end if;

  insert into public.coleccion_productos (coleccion_id, producto_id, tienda_id, orden)
  select nuevo, producto, p_tienda, ordinalidad - 1
  from unnest(coalesce(p_productos, '{}'::uuid[])) with ordinality as lista(producto, ordinalidad);

  return nuevo;
end;
$$;

revoke all on function public.precio_vigente(uuid, uuid) from public, anon, authenticated;
revoke all on function public.guardar_oferta(uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.guardar_coleccion(uuid, uuid, text, text, timestamptz, timestamptz, boolean, uuid[], uuid)
  from public, anon, authenticated;

grant execute on function public.precio_vigente(uuid, uuid) to service_role;
grant execute on function public.guardar_oferta(uuid, uuid, uuid, uuid, text, numeric, timestamptz, timestamptz, boolean, uuid) to service_role;
grant execute on function public.guardar_coleccion(uuid, uuid, text, text, timestamptz, timestamptz, boolean, uuid[], uuid) to service_role;
