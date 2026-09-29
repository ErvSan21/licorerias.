-- Celular opcional en pedidos de recojo (ventas en mostrador). Delivery lo sigue exigiendo.
-- crear_pedido es la misma que en 20260929000000_pedidos.sql salvo la regla del celular
-- y que guarda null cuando no hay.

alter table public.pedidos
  alter column telefono drop not null;

alter table public.pedidos
  drop constraint if exists pedidos_telefono;

alter table public.pedidos
  add constraint pedidos_telefono check (
    (telefono is null and tipo_entrega = 'recojo')
    or telefono ~ '^591[0-9]{8}$'
  );

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
  celular text := nullif(btrim(coalesce(p_telefono, '')), '');
begin
  if p_tipo not in ('delivery', 'recojo') then
    raise exception 'El tipo de entrega no es válido.';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre.';
  end if;
  -- El celular es obligatorio para delivery; en recojo es opcional.
  if celular is null then
    if p_tipo = 'delivery' then
      raise exception 'Escribe un celular de Bolivia.';
    end if;
  elsif celular !~ '^591[0-9]{8}$' then
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
    celular,
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
