-- Módulo 3: catálogo central, precio por sucursal e historial.
-- precio_base es la única fuente del precio base.
-- Las funciones de precio son solo de servidor: security definer,
-- search_path fijo, sin execute para public, anon ni authenticated.
-- configuracion_tienda nace aquí solo con las columnas de precio.
-- La marca (logo, color, banner) se agrega en el módulo 11.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  nombre text not null,
  orden integer not null default 0,
  activa boolean not null default true,
  constraint categorias_nombre_no_vacio check (length(btrim(nombre)) > 0)
);

create unique index categorias_nombre_tienda_idx
  on public.categorias (tienda_id, lower(nombre));

create index categorias_tienda_orden_idx
  on public.categorias (tienda_id, orden, nombre);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  nombre text not null,
  descripcion text,
  categoria_id uuid references public.categorias (id) on delete restrict,
  imagen_url text,
  precio_central numeric(10, 2) not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint productos_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint productos_precio_central_no_negativo check (precio_central >= 0)
);

create index productos_tienda_idx on public.productos (tienda_id, activo, nombre);
create index productos_categoria_idx on public.productos (categoria_id);

create table public.producto_sucursal (
  producto_id uuid not null references public.productos (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  usa_precio_central boolean not null default true,
  precio_propio numeric(10, 2),
  disponible boolean not null default true,
  primary key (producto_id, sucursal_id),
  constraint producto_sucursal_precio_propio check (
    (
      usa_precio_central
      and (precio_propio is null or precio_propio >= 0)
    )
    or (
      not usa_precio_central
      and precio_propio is not null
      and precio_propio >= 0
    )
  )
);

create index producto_sucursal_sucursal_idx on public.producto_sucursal (sucursal_id);
create index producto_sucursal_tienda_idx on public.producto_sucursal (tienda_id);

create table public.historial_precios (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  sucursal_id uuid references public.sucursales (id) on delete cascade,
  tipo text not null,
  precio_anterior numeric(10, 2),
  precio_nuevo numeric(10, 2) not null,
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint historial_tipo_valido check (tipo in ('central', 'propio')),
  constraint historial_precio_nuevo_no_negativo check (precio_nuevo >= 0),
  constraint historial_precio_anterior_no_negativo check (
    precio_anterior is null or precio_anterior >= 0
  ),
  constraint historial_propio_con_sucursal check (
    tipo = 'central' or sucursal_id is not null
  )
);

create index historial_precios_producto_idx
  on public.historial_precios (producto_id, creado_en desc);

create table public.configuracion_tienda (
  tienda_id uuid primary key references public.tiendas (id) on delete cascade,
  sucursales_pueden_fijar_precio boolean not null default true,
  margen_max_porcentaje numeric(6, 2),
  constraint configuracion_margen_no_negativo check (
    margen_max_porcentaje is null or margen_max_porcentaje >= 0
  )
);

insert into public.configuracion_tienda (tienda_id)
select id from public.tiendas
on conflict (tienda_id) do nothing;

alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.producto_sucursal enable row level security;
alter table public.historial_precios enable row level security;
alter table public.configuracion_tienda enable row level security;

revoke all on table public.categorias from public, anon, authenticated;
revoke all on table public.productos from public, anon, authenticated;
revoke all on table public.producto_sucursal from public, anon, authenticated;
revoke all on table public.historial_precios from public, anon, authenticated;
revoke all on table public.configuracion_tienda from public, anon, authenticated;

grant select on table public.categorias to authenticated;
grant select on table public.productos to authenticated;
grant select on table public.producto_sucursal to authenticated;
grant select on table public.historial_precios to authenticated;
grant select on table public.configuracion_tienda to authenticated;

grant all on table public.categorias to service_role;
grant all on table public.productos to service_role;
grant all on table public.producto_sucursal to service_role;
grant all on table public.historial_precios to service_role;
grant all on table public.configuracion_tienda to service_role;

create policy categorias_select on public.categorias
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = categorias.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy productos_select on public.productos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = productos.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy producto_sucursal_select on public.producto_sucursal
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = producto_sucursal.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = producto_sucursal.sucursal_id
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy historial_precios_select on public.historial_precios
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = historial_precios.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or historial_precios.sucursal_id is null
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = historial_precios.sucursal_id
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy configuracion_tienda_select on public.configuracion_tienda
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = configuracion_tienda.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create or replace function public.trg_configuracion_tienda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.configuracion_tienda (tienda_id)
  values (new.id)
  on conflict (tienda_id) do nothing;
  return new;
end;
$$;

create trigger tiendas_configuracion_precio
  after insert on public.tiendas
  for each row
  execute function public.trg_configuracion_tienda();

create or replace function public.trg_cupo_productos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.activo then
    perform public.exigir_cupo_plan(new.tienda_id, 'productos');
  elsif tg_op = 'UPDATE' and new.activo and not old.activo then
    perform public.exigir_cupo_plan(new.tienda_id, 'productos');
  end if;
  return new;
end;
$$;

create trigger productos_cupo_plan
  before insert or update of activo on public.productos
  for each row
  execute function public.trg_cupo_productos();

create or replace function public.trg_producto_categoria_tienda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.categoria_id is not null and not exists (
    select 1
    from public.categorias as c
    where c.id = new.categoria_id
      and c.tienda_id = new.tienda_id
  ) then
    raise exception 'La categoría no pertenece a la tienda.';
  end if;
  return new;
end;
$$;

create trigger productos_categoria_tienda
  before insert or update of categoria_id, tienda_id on public.productos
  for each row
  execute function public.trg_producto_categoria_tienda();

create or replace function public.trg_precio_central_reglas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.precio_central is distinct from old.precio_central
    and current_setting('app.precio_autorizado', true) is distinct from '1' then
    raise exception 'El precio central solo lo cambia el servidor.';
  end if;

  if new.precio_central is distinct from old.precio_central and exists (
    select 1
    from public.producto_sucursal as ps
    join public.configuracion_tienda as c on c.tienda_id = new.tienda_id
    where ps.producto_id = new.id
      and not ps.usa_precio_central
      and c.margen_max_porcentaje is not null
      and ps.precio_propio > round(new.precio_central * (1 + c.margen_max_porcentaje / 100), 2)
  ) then
    raise exception 'Hay precios propios que superarían el margen máximo.';
  end if;

  return new;
end;
$$;

create trigger productos_precio_central_reglas
  before update of precio_central on public.productos
  for each row
  execute function public.trg_precio_central_reglas();

create or replace function public.trg_producto_sucursal_reglas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tienda_producto uuid;
  tienda_sucursal uuid;
  central numeric(10, 2);
  permite boolean;
  margen numeric(6, 2);
  tope numeric(10, 2);
begin
  if tg_op = 'UPDATE'
    and (
      new.usa_precio_central is distinct from old.usa_precio_central
      or new.precio_propio is distinct from old.precio_propio
    )
    and current_setting('app.precio_autorizado', true) is distinct from '1' then
    raise exception 'El precio de la sucursal solo lo cambia el servidor.';
  end if;

  if tg_op = 'INSERT'
    and not new.usa_precio_central
    and current_setting('app.precio_autorizado', true) is distinct from '1' then
    raise exception 'El precio de la sucursal solo lo cambia el servidor.';
  end if;

  select p.tienda_id, p.precio_central
    into tienda_producto, central
  from public.productos as p
  where p.id = new.producto_id;

  select s.tienda_id
    into tienda_sucursal
  from public.sucursales as s
  where s.id = new.sucursal_id;

  if tienda_producto is null or tienda_producto <> new.tienda_id then
    raise exception 'El producto no pertenece a la tienda.';
  end if;

  if tienda_sucursal is null or tienda_sucursal <> new.tienda_id then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  if not new.usa_precio_central then
    if new.precio_propio is null or new.precio_propio < 0 then
      raise exception 'El precio propio es obligatorio.';
    end if;

    select c.sucursales_pueden_fijar_precio, c.margen_max_porcentaje
      into permite, margen
    from public.configuracion_tienda as c
    where c.tienda_id = new.tienda_id;

    if not coalesce(permite, true) then
      raise exception 'Esta tienda no permite precios propios.';
    end if;

    if margen is not null then
      tope := round(central * (1 + margen / 100), 2);
      if new.precio_propio > tope then
        raise exception 'El precio propio supera el margen máximo.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger producto_sucursal_reglas
  before insert or update on public.producto_sucursal
  for each row
  execute function public.trg_producto_sucursal_reglas();

create or replace function public.trg_configuracion_margen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursales_pueden_fijar_precio
    and new.margen_max_porcentaje is not null
    and exists (
      select 1
      from public.producto_sucursal as ps
      join public.productos as p on p.id = ps.producto_id
      where ps.tienda_id = new.tienda_id
        and not ps.usa_precio_central
        and ps.precio_propio > round(p.precio_central * (1 + new.margen_max_porcentaje / 100), 2)
    ) then
    raise exception 'Hay precios propios por encima del margen máximo.';
  end if;
  return new;
end;
$$;

create trigger configuracion_tienda_margen
  before update of sucursales_pueden_fijar_precio, margen_max_porcentaje
  on public.configuracion_tienda
  for each row
  execute function public.trg_configuracion_margen();

-- Solo cuenta una fila disponible. Si la tienda bloquea el precio propio, devuelve el central.
create or replace function public.precio_base(p_producto uuid, p_sucursal uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when ps.usa_precio_central or not coalesce(c.sucursales_pueden_fijar_precio, true)
      then p.precio_central
    else ps.precio_propio
  end
  from public.producto_sucursal as ps
  join public.productos as p on p.id = ps.producto_id
  left join public.configuracion_tienda as c on c.tienda_id = ps.tienda_id
  where ps.producto_id = p_producto
    and ps.sucursal_id = p_sucursal
    and ps.disponible
    and p.activo;
$$;

create or replace function public.crear_producto(
  p_tienda uuid,
  p_nombre text,
  p_descripcion text,
  p_categoria uuid,
  p_precio numeric,
  p_sucursales uuid[],
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo uuid;
  precio numeric(10, 2);
  esperadas integer;
  asignadas integer;
begin
  if p_precio is null or p_precio < 0 then
    raise exception 'El precio central no puede ser negativo.';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre del producto.';
  end if;

  precio := round(p_precio, 2);

  insert into public.productos (
    tienda_id,
    nombre,
    descripcion,
    categoria_id,
    precio_central,
    activo
  )
  values (
    p_tienda,
    btrim(p_nombre),
    nullif(btrim(coalesce(p_descripcion, '')), ''),
    p_categoria,
    precio,
    true
  )
  returning id into nuevo;

  insert into public.historial_precios (
    tienda_id,
    producto_id,
    sucursal_id,
    tipo,
    precio_anterior,
    precio_nuevo,
    user_id
  )
  values (p_tienda, nuevo, null, 'central', null, precio, p_user);

  select count(distinct valor)::integer
    into esperadas
  from unnest(coalesce(p_sucursales, '{}'::uuid[])) as lista(valor);

  insert into public.producto_sucursal (
    producto_id,
    sucursal_id,
    tienda_id,
    usa_precio_central,
    precio_propio,
    disponible
  )
  select nuevo, s.id, p_tienda, true, null, true
  from public.sucursales as s
  where s.tienda_id = p_tienda
    and s.id = any(coalesce(p_sucursales, '{}'::uuid[]));

  get diagnostics asignadas = row_count;
  if asignadas <> esperadas then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  return nuevo;
end;
$$;

create or replace function public.guardar_precio_central(
  p_tienda uuid,
  p_producto uuid,
  p_precio numeric,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tienda uuid;
  anterior numeric(10, 2);
  precio numeric(10, 2);
begin
  if p_precio is null or p_precio < 0 then
    raise exception 'El precio central no puede ser negativo.';
  end if;

  select p.tienda_id, p.precio_central
    into tienda, anterior
  from public.productos as p
  where p.id = p_producto
  for update;

  if not found then
    raise exception 'Producto no encontrado.';
  end if;

  if tienda <> p_tienda then
    raise exception 'El producto no pertenece a la tienda.';
  end if;

  precio := round(p_precio, 2);
  if precio = anterior then
    return;
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  update public.productos
  set precio_central = precio
  where id = p_producto;

  insert into public.historial_precios (
    tienda_id,
    producto_id,
    sucursal_id,
    tipo,
    precio_anterior,
    precio_nuevo,
    user_id
  )
  values (tienda, p_producto, null, 'central', anterior, precio, p_user);
end;
$$;

create or replace function public.guardar_precio_sucursal(
  p_tienda uuid,
  p_producto uuid,
  p_sucursal uuid,
  p_usa_central boolean,
  p_precio numeric,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.producto_sucursal%rowtype;
  central numeric(10, 2);
  precio numeric(10, 2);
begin
  select ps.*
    into fila
  from public.producto_sucursal as ps
  where ps.producto_id = p_producto
    and ps.sucursal_id = p_sucursal
    and ps.tienda_id = p_tienda
  for update;

  if not found then
    raise exception 'El producto no se ofrece en esa sucursal.';
  end if;

  select p.precio_central
    into central
  from public.productos as p
  where p.id = p_producto
  for update;

  perform set_config('app.precio_autorizado', '1', true);

  if p_usa_central then
    if fila.usa_precio_central then
      return;
    end if;

    update public.producto_sucursal
    set usa_precio_central = true,
        precio_propio = null
    where producto_id = p_producto
      and sucursal_id = p_sucursal;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (fila.tienda_id, p_producto, p_sucursal, 'central', fila.precio_propio, central, p_user);
    return;
  end if;

  if p_precio is null or p_precio < 0 then
    raise exception 'El precio propio es obligatorio.';
  end if;

  precio := round(p_precio, 2);
  if not fila.usa_precio_central and fila.precio_propio = precio then
    return;
  end if;

  update public.producto_sucursal
  set usa_precio_central = false,
      precio_propio = precio
  where producto_id = p_producto
    and sucursal_id = p_sucursal;

  insert into public.historial_precios (
    tienda_id,
    producto_id,
    sucursal_id,
    tipo,
    precio_anterior,
    precio_nuevo,
    user_id
  )
  values (
    fila.tienda_id,
    p_producto,
    p_sucursal,
    'propio',
    case when fila.usa_precio_central then central else fila.precio_propio end,
    precio,
    p_user
  );
end;
$$;

create or replace function public.fijar_sucursales_producto(
  p_tienda uuid,
  p_producto uuid,
  p_sucursales uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tienda uuid;
  esperadas integer;
  encontradas integer;
begin
  select p.tienda_id
    into tienda
  from public.productos as p
  where p.id = p_producto
    and p.tienda_id = p_tienda
  for update;

  if not found then
    raise exception 'Producto no encontrado.';
  end if;

  select count(distinct valor)::integer
    into esperadas
  from unnest(coalesce(p_sucursales, '{}'::uuid[])) as lista(valor);

  select count(*)
    into encontradas
  from public.sucursales as s
  where s.tienda_id = tienda
    and s.id = any(coalesce(p_sucursales, '{}'::uuid[]));

  if encontradas <> esperadas then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  insert into public.producto_sucursal (
    producto_id,
    sucursal_id,
    tienda_id,
    usa_precio_central,
    precio_propio,
    disponible
  )
  select p_producto, s.id, tienda, true, null, true
  from public.sucursales as s
  where s.tienda_id = tienda
    and s.id = any(coalesce(p_sucursales, '{}'::uuid[]))
    and not exists (
      select 1
      from public.producto_sucursal as ps
      where ps.producto_id = p_producto
        and ps.sucursal_id = s.id
    );

  update public.producto_sucursal
  set disponible = sucursal_id = any(coalesce(p_sucursales, '{}'::uuid[]))
  where producto_id = p_producto;
end;
$$;

create or replace function public.guardar_configuracion_precios(
  p_tienda uuid,
  p_permite boolean,
  p_margen numeric,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fila record;
begin
  if p_margen is not null and p_margen < 0 then
    raise exception 'El margen máximo no puede ser negativo.';
  end if;

  insert into public.configuracion_tienda (
    tienda_id,
    sucursales_pueden_fijar_precio,
    margen_max_porcentaje
  )
  values (p_tienda, p_permite, case when p_margen is null then null else round(p_margen, 2) end)
  on conflict (tienda_id) do update
  set sucursales_pueden_fijar_precio = excluded.sucursales_pueden_fijar_precio,
      margen_max_porcentaje = excluded.margen_max_porcentaje;

  if p_permite then
    return;
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  for fila in
    select ps.producto_id, ps.sucursal_id, ps.precio_propio, p.precio_central
    from public.producto_sucursal as ps
    join public.productos as p on p.id = ps.producto_id
    where ps.tienda_id = p_tienda
      and not ps.usa_precio_central
    for update
  loop
    update public.producto_sucursal
    set usa_precio_central = true,
        precio_propio = null
    where producto_id = fila.producto_id
      and sucursal_id = fila.sucursal_id;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (
      p_tienda,
      fila.producto_id,
      fila.sucursal_id,
      'central',
      fila.precio_propio,
      fila.precio_central,
      p_user
    );
  end loop;
end;
$$;

create or replace function public.volver_precios_centrales(
  p_tienda uuid,
  p_sucursal uuid,
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fila record;
  total integer := 0;
begin
  if not exists (
    select 1
    from public.sucursales as s
    where s.id = p_sucursal
      and s.tienda_id = p_tienda
  ) then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  for fila in
    select ps.tienda_id, ps.producto_id, ps.precio_propio, p.precio_central
    from public.producto_sucursal as ps
    join public.productos as p on p.id = ps.producto_id
    where ps.sucursal_id = p_sucursal
      and ps.tienda_id = p_tienda
      and not ps.usa_precio_central
    for update
  loop
    update public.producto_sucursal
    set usa_precio_central = true,
        precio_propio = null
    where producto_id = fila.producto_id
      and sucursal_id = p_sucursal;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (
      fila.tienda_id,
      fila.producto_id,
      p_sucursal,
      'central',
      fila.precio_propio,
      fila.precio_central,
      p_user
    );
    total := total + 1;
  end loop;

  return total;
end;
$$;

create or replace function public.ajustar_precio_central_categoria(
  p_tienda uuid,
  p_categoria uuid,
  p_porcentaje numeric,
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fila record;
  nuevo numeric(10, 2);
  total integer := 0;
begin
  if p_porcentaje is null or p_porcentaje < -100 or p_porcentaje > 1000 then
    raise exception 'El porcentaje tiene que estar entre -100 y 1000.';
  end if;

  if not exists (
    select 1
    from public.categorias as c
    where c.id = p_categoria
      and c.tienda_id = p_tienda
  ) then
    raise exception 'La categoría no pertenece a la tienda.';
  end if;

  if exists (
    select 1
    from public.productos as p
    where p.tienda_id = p_tienda
      and p.categoria_id = p_categoria
      and round(p.precio_central * (1 + p_porcentaje / 100), 2) < 0
  ) then
    raise exception 'El ajuste dejaría un precio negativo.';
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  for fila in
    select p.id, p.precio_central
    from public.productos as p
    where p.tienda_id = p_tienda
      and p.categoria_id = p_categoria
    for update
  loop
    nuevo := round(fila.precio_central * (1 + p_porcentaje / 100), 2);
    if nuevo = fila.precio_central then
      continue;
    end if;

    update public.productos
    set precio_central = nuevo
    where id = fila.id;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (p_tienda, fila.id, null, 'central', fila.precio_central, nuevo, p_user);
    total := total + 1;
  end loop;

  return total;
end;
$$;

create or replace function public.ajustar_precios_propios(
  p_tienda uuid,
  p_sucursal uuid,
  p_porcentaje numeric,
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fila record;
  nuevo numeric(10, 2);
  total integer := 0;
begin
  if p_porcentaje is null or p_porcentaje < -100 or p_porcentaje > 1000 then
    raise exception 'El porcentaje tiene que estar entre -100 y 1000.';
  end if;

  if not exists (
    select 1
    from public.sucursales as s
    where s.id = p_sucursal
      and s.tienda_id = p_tienda
  ) then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  if exists (
    select 1
    from public.producto_sucursal as ps
    where ps.sucursal_id = p_sucursal
      and ps.tienda_id = p_tienda
      and not ps.usa_precio_central
      and round(ps.precio_propio * (1 + p_porcentaje / 100), 2) < 0
  ) then
    raise exception 'El ajuste dejaría un precio negativo.';
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  for fila in
    select ps.tienda_id, ps.producto_id, ps.precio_propio
    from public.producto_sucursal as ps
    where ps.sucursal_id = p_sucursal
      and ps.tienda_id = p_tienda
      and not ps.usa_precio_central
    for update
  loop
    nuevo := round(fila.precio_propio * (1 + p_porcentaje / 100), 2);
    if nuevo = fila.precio_propio then
      continue;
    end if;

    update public.producto_sucursal
    set precio_propio = nuevo
    where producto_id = fila.producto_id
      and sucursal_id = p_sucursal;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (fila.tienda_id, fila.producto_id, p_sucursal, 'propio', fila.precio_propio, nuevo, p_user);
    total := total + 1;
  end loop;

  return total;
end;
$$;

create or replace function public.copiar_precios_propios(
  p_tienda uuid,
  p_origen uuid,
  p_destino uuid,
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tienda uuid;
  fila record;
  total integer := 0;
begin
  select s.tienda_id
    into tienda
  from public.sucursales as s
  where s.id = p_origen
    and s.tienda_id = p_tienda;

  if tienda is null or not exists (
    select 1
    from public.sucursales as s
    where s.id = p_destino
      and s.tienda_id = p_tienda
  ) then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  if p_origen = p_destino then
    raise exception 'Elige otra sucursal de destino.';
  end if;

  perform set_config('app.precio_autorizado', '1', true);

  for fila in
    select
      origen.producto_id,
      origen.precio_propio,
      destino.usa_precio_central,
      destino.precio_propio as destino_precio,
      p.precio_central
    from public.producto_sucursal as origen
    join public.producto_sucursal as destino
      on destino.producto_id = origen.producto_id
      and destino.sucursal_id = p_destino
    join public.productos as p on p.id = origen.producto_id
    where origen.sucursal_id = p_origen
      and origen.tienda_id = p_tienda
      and not origen.usa_precio_central
    for update of origen, destino
  loop
    if not fila.usa_precio_central and fila.destino_precio = fila.precio_propio then
      continue;
    end if;

    update public.producto_sucursal
    set usa_precio_central = false,
        precio_propio = fila.precio_propio
    where producto_id = fila.producto_id
      and sucursal_id = p_destino;

    insert into public.historial_precios (
      tienda_id,
      producto_id,
      sucursal_id,
      tipo,
      precio_anterior,
      precio_nuevo,
      user_id
    )
    values (
      tienda,
      fila.producto_id,
      p_destino,
      'propio',
      case when fila.usa_precio_central then fila.precio_central else fila.destino_precio end,
      fila.precio_propio,
      p_user
    );
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke all on function public.trg_configuracion_tienda() from public, anon, authenticated;
revoke all on function public.trg_cupo_productos() from public, anon, authenticated;
revoke all on function public.trg_producto_categoria_tienda() from public, anon, authenticated;
revoke all on function public.trg_precio_central_reglas() from public, anon, authenticated;
revoke all on function public.trg_producto_sucursal_reglas() from public, anon, authenticated;
revoke all on function public.trg_configuracion_margen() from public, anon, authenticated;
revoke all on function public.precio_base(uuid, uuid) from public, anon, authenticated;
revoke all on function public.crear_producto(uuid, text, text, uuid, numeric, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.guardar_precio_central(uuid, uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.guardar_precio_sucursal(uuid, uuid, uuid, boolean, numeric, uuid) from public, anon, authenticated;
revoke all on function public.fijar_sucursales_producto(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.guardar_configuracion_precios(uuid, boolean, numeric, uuid) from public, anon, authenticated;
revoke all on function public.volver_precios_centrales(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.ajustar_precio_central_categoria(uuid, uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.ajustar_precios_propios(uuid, uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.copiar_precios_propios(uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.trg_configuracion_tienda() to service_role;
grant execute on function public.trg_cupo_productos() to service_role;
grant execute on function public.trg_producto_categoria_tienda() to service_role;
grant execute on function public.trg_precio_central_reglas() to service_role;
grant execute on function public.trg_producto_sucursal_reglas() to service_role;
grant execute on function public.trg_configuracion_margen() to service_role;
grant execute on function public.precio_base(uuid, uuid) to service_role;
grant execute on function public.crear_producto(uuid, text, text, uuid, numeric, uuid[], uuid) to service_role;
grant execute on function public.guardar_precio_central(uuid, uuid, numeric, uuid) to service_role;
grant execute on function public.guardar_precio_sucursal(uuid, uuid, uuid, boolean, numeric, uuid) to service_role;
grant execute on function public.fijar_sucursales_producto(uuid, uuid, uuid[]) to service_role;
grant execute on function public.guardar_configuracion_precios(uuid, boolean, numeric, uuid) to service_role;
grant execute on function public.volver_precios_centrales(uuid, uuid, uuid) to service_role;
grant execute on function public.ajustar_precio_central_categoria(uuid, uuid, numeric, uuid) to service_role;
grant execute on function public.ajustar_precios_propios(uuid, uuid, numeric, uuid) to service_role;
grant execute on function public.copiar_precios_propios(uuid, uuid, uuid, uuid) to service_role;

-- Storage público de lectura. Escritura solo para el personal de esa tienda.
-- En Postgres local no existe el esquema storage: ahí no se crean políticas.
do $storage$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('productos', 'productos', true)
  on conflict (id) do update set public = excluded.public;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'productos_lectura_publica'
  ) then
    create policy productos_lectura_publica on storage.objects
      for select
      to public
      using (bucket_id = 'productos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'productos_alta_personal'
  ) then
    create policy productos_alta_personal on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'productos'
        and (storage.foldername(name))[2] = 'productos'
        and (storage.foldername(name))[1] in (
          select m.tienda_id::text
          from public.miembros as m
          where m.user_id = (select auth.uid())
            and m.activo
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'productos_cambio_personal'
  ) then
    create policy productos_cambio_personal on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'productos'
        and (storage.foldername(name))[2] = 'productos'
        and (storage.foldername(name))[1] in (
          select m.tienda_id::text
          from public.miembros as m
          where m.user_id = (select auth.uid())
            and m.activo
        )
      )
      with check (
        bucket_id = 'productos'
        and (storage.foldername(name))[2] = 'productos'
        and (storage.foldername(name))[1] in (
          select m.tienda_id::text
          from public.miembros as m
          where m.user_id = (select auth.uid())
            and m.activo
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'productos_borrado_personal'
  ) then
    create policy productos_borrado_personal on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'productos'
        and (storage.foldername(name))[2] = 'productos'
        and (storage.foldername(name))[1] in (
          select m.tienda_id::text
          from public.miembros as m
          where m.user_id = (select auth.uid())
            and m.activo
        )
      );
  end if;
end
$storage$;
