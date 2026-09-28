-- Pedidos por sucursal. El stock y el estado solo cambian aquí.

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete restrict,
  cliente_nombre text not null,
  telefono text not null,
  tipo_entrega text not null,
  lat double precision,
  lng double precision,
  direccion text not null default '',
  direccion_referencia text,
  distancia_km numeric(6, 1) not null default 0,
  subtotal numeric(10, 2) not null,
  costo_envio numeric(10, 2) not null default 0,
  descuento numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  hora_recojo timestamptz,
  estado text not null default 'pendiente',
  creado_en timestamptz not null default now(),
  constraint pedidos_nombre check (length(btrim(cliente_nombre)) >= 2),
  constraint pedidos_telefono check (telefono ~ '^591[0-9]{8}$'),
  constraint pedidos_tipo check (tipo_entrega in ('delivery', 'recojo')),
  constraint pedidos_estado check (estado in ('pendiente', 'aceptado', 'listo', 'enviado', 'cancelado')),
  constraint pedidos_importes check (
    subtotal >= 0
    and costo_envio >= 0
    and descuento >= 0
    and total = subtotal + costo_envio
  ),
  constraint pedidos_recojo check (
    tipo_entrega <> 'recojo'
    or (
      lat is null
      and lng is null
      and distancia_km = 0
      and costo_envio = 0
    )
  ),
  constraint pedidos_delivery check (
    tipo_entrega <> 'delivery'
    or (lat between -90 and 90 and lng between -180 and 180 and length(btrim(direccion)) >= 4)
  )
);

create index pedidos_sucursal_idx on public.pedidos (sucursal_id, creado_en desc);
create index pedidos_estado_idx on public.pedidos (sucursal_id, estado, creado_en desc);

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete restrict,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  nombre_producto text not null,
  cantidad integer not null,
  precio_original numeric(10, 2) not null,
  precio_unitario numeric(10, 2) not null,
  origen_precio text not null,
  constraint pedido_items_cantidad check (cantidad > 0),
  constraint pedido_items_origen check (origen_precio in ('central', 'propio', 'oferta'))
);

create index pedido_items_pedido_idx on public.pedido_items (pedido_id);

create table public.pedido_historial (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  estado text not null,
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint pedido_historial_estado check (estado in ('pendiente', 'aceptado', 'listo', 'enviado', 'cancelado'))
);

create index pedido_historial_pedido_idx on public.pedido_historial (pedido_id, creado_en);

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedido_historial enable row level security;

revoke all on table public.pedidos from public, anon, authenticated;
revoke all on table public.pedido_items from public, anon, authenticated;
revoke all on table public.pedido_historial from public, anon, authenticated;

grant select on table public.pedidos to authenticated;
grant select on table public.pedido_items to authenticated;
grant select on table public.pedido_historial to authenticated;

grant all on table public.pedidos to service_role;
grant all on table public.pedido_items to service_role;
grant all on table public.pedido_historial to service_role;

create policy pedidos_select on public.pedidos
  for select to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = pedidos.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = pedidos.sucursal_id
          )
        )
    )
    or exists (select 1 from public.super_admins as s where s.user_id = (select auth.uid()))
  );

create policy pedido_items_select on public.pedido_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.pedidos as p
      join public.miembros as m on m.tienda_id = p.tienda_id
      where p.id = pedido_items.pedido_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = p.sucursal_id
          )
        )
    )
    or exists (select 1 from public.super_admins as s where s.user_id = (select auth.uid()))
  );

create policy pedido_historial_select on public.pedido_historial
  for select to authenticated
  using (
    exists (
      select 1
      from public.pedidos as p
      join public.miembros as m on m.tienda_id = p.tienda_id
      where p.id = pedido_historial.pedido_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = p.sucursal_id
          )
        )
    )
    or exists (select 1 from public.super_admins as s where s.user_id = (select auth.uid()))
  );

alter table public.pedidos replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'pedidos'
    ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end
$$;

create or replace function public.crear_pedido(
  p_sucursal uuid,
  p_nombre text,
  p_telefono text,
  p_tipo text,
  p_lat double precision,
  p_lng double precision,
  p_direccion text,
  p_referencia text,
  p_distancia numeric,
  p_envio numeric,
  p_hora_recojo timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  suc public.sucursales%rowtype;
  pedido uuid;
  fila record;
  precio jsonb;
  cantidad integer;
  original numeric(10, 2);
  final numeric(10, 2);
  origen text;
  subtotal numeric(10, 2) := 0;
  descuento numeric(10, 2) := 0;
  envio numeric(10, 2);
  distancia numeric(6, 1);
  latitud double precision;
  longitud double precision;
  momento timestamptz;
  local_ts timestamp;
  clave text;
  franja jsonb;
  abierto boolean;
  hora_txt text;
begin
  if p_tipo not in ('delivery', 'recojo') then
    raise exception 'El tipo de entrega no es válido.';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre.';
  end if;
  if coalesce(p_telefono, '') !~ '^591[0-9]{8}$' then
    raise exception 'Escribe un celular de Bolivia.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega un producto.';
  end if;

  select * into suc from public.sucursales where id = p_sucursal for update;
  if not found then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  perform public.exigir_licencia_vigente(suc.tienda_id);

  if not suc.activa or not suc.abierta then
    raise exception 'La sucursal está cerrada.';
  end if;
  if p_tipo = 'delivery' and not suc.acepta_delivery then
    raise exception 'Esta sucursal no acepta delivery.';
  end if;
  if p_tipo = 'recojo' and not suc.acepta_recojo then
    raise exception 'Esta sucursal no acepta recojo.';
  end if;

  momento := coalesce(p_hora_recojo, now());
  if p_hora_recojo is not null and p_tipo <> 'recojo' then
    raise exception 'La hora programada es solo para recojo.';
  end if;
  if p_hora_recojo is not null
    and p_hora_recojo < now() + make_interval(mins => suc.minutos_anticipacion_recojo) then
    raise exception 'Elige una hora con más anticipación.';
  end if;

  local_ts := momento at time zone 'America/La_Paz';
  clave := (array['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'])[extract(dow from local_ts)::int + 1];
  franja := suc.horario -> clave;
  abierto := coalesce((franja ->> 'abierto')::boolean, false);
  hora_txt := to_char(local_ts, 'HH24:MI');
  if not abierto
    or franja ->> 'desde' is null
    or hora_txt < (franja ->> 'desde')
    or hora_txt >= (franja ->> 'hasta') then
    raise exception 'La sucursal está cerrada a esa hora.';
  end if;

  if p_tipo = 'recojo' then
    envio := 0;
    distancia := 0;
    latitud := null;
    longitud := null;
  else
    if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'La latitud tiene que estar entre -90 y 90.';
    end if;
    if length(btrim(coalesce(p_direccion, ''))) < 4 then
      raise exception 'Escribe la dirección.';
    end if;
    if p_envio is null or p_envio < 0 or p_distancia is null or p_distancia < 0 then
      raise exception 'Fuera de zona de entrega.';
    end if;
    envio := round(p_envio, 2);
    distancia := round(p_distancia, 1);
    latitud := p_lat;
    longitud := p_lng;
  end if;

  create temporary table if not exists pedido_lineas (
    producto_id uuid primary key,
    cantidad integer not null,
    nombre text not null,
    precio_original numeric(10, 2) not null,
    precio_unitario numeric(10, 2) not null,
    origen_precio text not null
  ) on commit drop;
  truncate pedido_lineas;

  for fila in
    select (elem ->> 'producto_id')::uuid as producto_id, sum((elem ->> 'cantidad')::integer) as cantidad
    from jsonb_array_elements(p_items) as elem
    group by 1
    order by 1
  loop
    cantidad := fila.cantidad;
    if fila.producto_id is null or cantidad is null or cantidad <= 0 or cantidad > 99 then
      raise exception 'La cantidad tiene que ser mayor que cero.';
    end if;

    perform 1
    from public.producto_sucursal as ps
    where ps.sucursal_id = suc.id
      and ps.producto_id = fila.producto_id
      and ps.tienda_id = suc.tienda_id
      and ps.disponible
    for update;
    if not found then
      raise exception 'El producto no se ofrece en esa sucursal.';
    end if;

    precio := public.precio_vigente(fila.producto_id, suc.id);
    if precio is null then
      raise exception 'El producto no se ofrece en esa sucursal.';
    end if;
    original := (precio ->> 'precio_original')::numeric;
    final := (precio ->> 'precio_final')::numeric;
    origen := precio ->> 'origen_precio';

    insert into pedido_lineas (producto_id, cantidad, nombre, precio_original, precio_unitario, origen_precio)
    select fila.producto_id, cantidad, p.nombre, original, final, origen
    from public.productos as p
    where p.id = fila.producto_id
      and p.tienda_id = suc.tienda_id
      and p.activo;
    if not found then
      raise exception 'El producto no pertenece a la tienda.';
    end if;
  end loop;

  select coalesce(sum(linea.precio_unitario * linea.cantidad), 0),
    coalesce(sum((linea.precio_original - linea.precio_unitario) * linea.cantidad), 0)
  into subtotal, descuento
  from pedido_lineas as linea;

  insert into public.pedidos (
    tienda_id, sucursal_id, cliente_nombre, telefono, tipo_entrega,
    lat, lng, direccion, direccion_referencia, distancia_km,
    subtotal, costo_envio, descuento, total, hora_recojo, estado
  )
  values (
    suc.tienda_id,
    suc.id,
    btrim(p_nombre),
    p_telefono,
    p_tipo,
    latitud,
    longitud,
    case when p_tipo = 'delivery' then btrim(p_direccion) else '' end,
    nullif(btrim(coalesce(p_referencia, '')), ''),
    distancia,
    subtotal,
    envio,
    descuento,
    subtotal + envio,
    case when p_tipo = 'recojo' then p_hora_recojo else null end,
    'pendiente'
  )
  returning id into pedido;

  insert into public.pedido_items (
    pedido_id, producto_id, tienda_id, nombre_producto, cantidad, precio_original, precio_unitario, origen_precio
  )
  select pedido, linea.producto_id, suc.tienda_id, linea.nombre, linea.cantidad,
    linea.precio_original, linea.precio_unitario, linea.origen_precio
  from pedido_lineas as linea
  order by linea.producto_id;

  for fila in select linea.producto_id, linea.cantidad from pedido_lineas as linea order by linea.producto_id loop
    perform public.ajustar_stock(suc.id, fila.producto_id, fila.cantidad, 'venta', 'Pedido', null);
  end loop;

  insert into public.pedido_historial (pedido_id, tienda_id, estado, user_id)
  values (pedido, suc.tienda_id, 'pendiente', null);

  return pedido;
end;
$$;

create or replace function public.cambiar_estado(p_pedido uuid, p_nuevo text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedidos%rowtype;
  item record;
  permitido boolean := false;
begin
  if p_nuevo not in ('aceptado', 'listo', 'enviado', 'cancelado') then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  select * into ped from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;

  if not exists (
    select 1
    from public.miembros as m
    where m.user_id = p_user
      and m.tienda_id = ped.tienda_id
      and m.activo
      and (
        m.rol = 'dueno'
        or exists (
          select 1
          from public.miembro_sucursales as ms
          where ms.miembro_id = m.id
            and ms.sucursal_id = ped.sucursal_id
        )
      )
  ) then
    raise exception 'No puedes cambiar este pedido.';
  end if;

  if ped.estado = 'pendiente' and p_nuevo in ('aceptado', 'cancelado') then
    permitido := true;
  elsif ped.estado = 'aceptado' and p_nuevo in ('listo', 'cancelado') then
    permitido := true;
  elsif ped.estado = 'listo' and p_nuevo = 'enviado' and ped.tipo_entrega = 'delivery' then
    permitido := true;
  end if;

  if not permitido then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  if p_nuevo = 'cancelado' then
    for item in
      select producto_id, cantidad
      from public.pedido_items
      where pedido_id = ped.id
      order by producto_id
    loop
      perform public.ajustar_stock(
        ped.sucursal_id,
        item.producto_id,
        item.cantidad,
        'cancelacion',
        'Cancelación de pedido',
        p_user
      );
    end loop;
  end if;

  update public.pedidos set estado = p_nuevo where id = ped.id;
  insert into public.pedido_historial (pedido_id, tienda_id, estado, user_id)
  values (ped.id, ped.tienda_id, p_nuevo, p_user);
  return p_nuevo;
end;
$$;

revoke all on function public.crear_pedido(uuid, text, text, text, double precision, double precision, text, text, numeric, numeric, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.cambiar_estado(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.crear_pedido(uuid, text, text, text, double precision, double precision, text, text, numeric, numeric, timestamptz, jsonb) to service_role;
grant execute on function public.cambiar_estado(uuid, text, uuid) to service_role;
