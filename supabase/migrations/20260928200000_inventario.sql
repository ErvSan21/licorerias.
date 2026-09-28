-- Inventario por sucursal. El stock solo cambia en funciones transaccionales.

alter table public.producto_sucursal
  add column stock integer not null default 0,
  add column stock_minimo integer not null default 5;

alter table public.producto_sucursal
  add constraint producto_sucursal_stock_no_negativo check (stock >= 0),
  add constraint producto_sucursal_minimo_no_negativo check (stock_minimo >= 0);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  tipo text not null,
  cantidad integer not null,
  motivo text,
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint movimientos_tipo_valido check (
    tipo in (
      'entrada',
      'salida',
      'ajuste',
      'venta',
      'cancelacion',
      'transferencia_in',
      'transferencia_out'
    )
  ),
  constraint movimientos_cantidad_distinta_de_cero check (cantidad <> 0)
);

create index movimientos_stock_producto_idx
  on public.movimientos_stock (sucursal_id, producto_id, creado_en desc);

create index movimientos_stock_tienda_idx
  on public.movimientos_stock (tienda_id, creado_en desc);

create table public.transferencias_stock (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_origen uuid not null references public.sucursales (id),
  sucursal_destino uuid not null references public.sucursales (id),
  producto_id uuid not null references public.productos (id),
  cantidad integer not null,
  user_id uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint transferencias_cantidad_positiva check (cantidad > 0),
  constraint transferencias_sucursales_distintas check (sucursal_origen <> sucursal_destino)
);

create index transferencias_stock_tienda_idx
  on public.transferencias_stock (tienda_id, creado_en desc);

alter table public.movimientos_stock enable row level security;
alter table public.transferencias_stock enable row level security;

revoke all on table public.movimientos_stock from public, anon, authenticated;
revoke all on table public.transferencias_stock from public, anon, authenticated;

grant select on table public.movimientos_stock to authenticated;
grant select on table public.transferencias_stock to authenticated;

grant all on table public.movimientos_stock to service_role;
grant all on table public.transferencias_stock to service_role;

create policy movimientos_stock_select on public.movimientos_stock
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = movimientos_stock.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id = movimientos_stock.sucursal_id
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

create policy transferencias_stock_select on public.transferencias_stock
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.miembros as m
      where m.tienda_id = transferencias_stock.tienda_id
        and m.user_id = (select auth.uid())
        and m.activo
        and (
          m.rol = 'dueno'
          or exists (
            select 1
            from public.miembro_sucursales as ms
            where ms.miembro_id = m.id
              and ms.sucursal_id in (
                transferencias_stock.sucursal_origen,
                transferencias_stock.sucursal_destino
              )
          )
        )
    )
    or exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );

-- cantidad es el delta firmado, salvo en ajuste, donde p_cantidad es el stock nuevo.
create or replace function public.ajustar_stock(
  p_sucursal uuid,
  p_producto uuid,
  p_cantidad integer,
  p_tipo text,
  p_motivo text,
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.producto_sucursal%rowtype;
  delta integer;
  nuevo integer;
  motivo text;
begin
  if p_tipo not in (
    'entrada',
    'salida',
    'ajuste',
    'venta',
    'cancelacion',
    'transferencia_in',
    'transferencia_out'
  ) then
    raise exception 'El tipo de movimiento no es válido.';
  end if;

  motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if p_tipo in ('entrada', 'salida', 'ajuste') and motivo is null then
    raise exception 'Escribe el motivo del movimiento.';
  end if;
  if motivo is not null and length(motivo) > 200 then
    raise exception 'El motivo es demasiado largo.';
  end if;

  select *
  into fila
  from public.producto_sucursal
  where sucursal_id = p_sucursal
    and producto_id = p_producto
  for update;

  if not found then
    raise exception 'El producto no se ofrece en esa sucursal.';
  end if;

  if p_tipo = 'ajuste' then
    if p_cantidad is null or p_cantidad < 0 then
      raise exception 'El stock no puede ser negativo.';
    end if;
    nuevo := p_cantidad;
    delta := nuevo - fila.stock;
    if delta = 0 then
      raise exception 'El stock no cambió.';
    end if;
  elsif p_tipo in ('entrada', 'cancelacion', 'transferencia_in') then
    if p_cantidad is null or p_cantidad <= 0 then
      raise exception 'La cantidad tiene que ser mayor que cero.';
    end if;
    delta := p_cantidad;
    nuevo := fila.stock + delta;
  else
    if p_cantidad is null or p_cantidad <= 0 then
      raise exception 'La cantidad tiene que ser mayor que cero.';
    end if;
    if fila.stock < p_cantidad then
      raise exception 'No hay stock suficiente.';
    end if;
    delta := -p_cantidad;
    nuevo := fila.stock + delta;
  end if;

  update public.producto_sucursal
  set stock = nuevo
  where sucursal_id = p_sucursal
    and producto_id = p_producto;

  insert into public.movimientos_stock (
    tienda_id,
    sucursal_id,
    producto_id,
    tipo,
    cantidad,
    motivo,
    user_id
  )
  values (
    fila.tienda_id,
    p_sucursal,
    p_producto,
    p_tipo,
    delta,
    motivo,
    p_user
  );

  return nuevo;
end;
$$;

create or replace function public.fijar_stock_minimo(
  p_sucursal uuid,
  p_producto uuid,
  p_minimo integer,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_minimo is null or p_minimo < 0 then
    raise exception 'El stock mínimo no puede ser negativo.';
  end if;

  update public.producto_sucursal
  set stock_minimo = p_minimo
  where sucursal_id = p_sucursal
    and producto_id = p_producto;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'El producto no se ofrece en esa sucursal.';
  end if;
end;
$$;

create or replace function public.transferir_stock(
  p_origen uuid,
  p_destino uuid,
  p_producto uuid,
  p_cantidad integer,
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tienda_origen uuid;
  tienda_destino uuid;
  origen_ok boolean;
  destino_ok boolean;
  transferencia uuid;
begin
  if p_origen is null or p_destino is null or p_origen = p_destino then
    raise exception 'Elige otra sucursal de destino.';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser mayor que cero.';
  end if;

  select tienda_id into tienda_origen from public.sucursales where id = p_origen;
  select tienda_id into tienda_destino from public.sucursales where id = p_destino;
  if tienda_origen is null or tienda_destino is null or tienda_origen <> tienda_destino then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  perform 1
  from public.producto_sucursal
  where producto_id = p_producto
    and sucursal_id in (p_origen, p_destino)
  order by sucursal_id
  for update;

  select exists (
    select 1
    from public.producto_sucursal
    where producto_id = p_producto
      and sucursal_id = p_origen
      and tienda_id = tienda_origen
  ) into origen_ok;

  select exists (
    select 1
    from public.producto_sucursal
    where producto_id = p_producto
      and sucursal_id = p_destino
      and tienda_id = tienda_destino
  ) into destino_ok;

  if not origen_ok then
    raise exception 'El producto no se ofrece en esa sucursal.';
  end if;
  if not destino_ok then
    raise exception 'Define primero la disponibilidad del producto en la sucursal de destino.';
  end if;

  perform public.ajustar_stock(
    p_origen,
    p_producto,
    p_cantidad,
    'transferencia_out',
    'Transferencia',
    p_user
  );
  perform public.ajustar_stock(
    p_destino,
    p_producto,
    p_cantidad,
    'transferencia_in',
    'Transferencia',
    p_user
  );

  insert into public.transferencias_stock (
    tienda_id,
    sucursal_origen,
    sucursal_destino,
    producto_id,
    cantidad,
    user_id
  )
  values (
    tienda_origen,
    p_origen,
    p_destino,
    p_producto,
    p_cantidad,
    p_user
  )
  returning id into transferencia;

  return transferencia;
end;
$$;

create or replace function public.importar_stock(
  p_tienda uuid,
  p_filas jsonb,
  p_sucursales uuid[],
  p_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fila jsonb;
  linea integer;
  v_slug text;
  v_nombre text;
  v_categoria text;
  stock_nuevo integer;
  minimo_nuevo integer;
  v_sucursal uuid;
  v_producto uuid;
  coincidencias integer;
  actual integer;
  aplicadas integer := 0;
begin
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'El archivo no tiene filas.';
  end if;
  if jsonb_array_length(p_filas) > 2000 then
    raise exception 'El archivo tiene demasiadas filas.';
  end if;

  for fila in select value from jsonb_array_elements(p_filas)
  loop
    linea := coalesce((fila ->> 'linea')::integer, 0);
    v_slug := lower(btrim(coalesce(fila ->> 'sucursal', '')));
    v_nombre := btrim(coalesce(fila ->> 'producto', ''));
    v_categoria := btrim(coalesce(fila ->> 'categoria', ''));
    begin
      stock_nuevo := (fila ->> 'stock')::integer;
      minimo_nuevo := (fila ->> 'stock_minimo')::integer;
    exception
      when others then
        raise exception 'Línea %: el stock tiene que ser un entero.', linea;
    end;

    if stock_nuevo is null or stock_nuevo < 0 or minimo_nuevo is null or minimo_nuevo < 0 then
      raise exception 'Línea %: el stock no puede ser negativo.', linea;
    end if;

    select s.id
    into v_sucursal
    from public.sucursales as s
    where s.tienda_id = p_tienda
      and s.slug = v_slug;

    if v_sucursal is null then
      raise exception 'Línea %: No encontré la sucursal.', linea;
    end if;
    if p_sucursales is null or not (v_sucursal = any (p_sucursales)) then
      raise exception 'Línea %: No tienes acceso a esa sucursal.', linea;
    end if;

    select count(*)
    into coincidencias
    from public.productos as p
    left join public.categorias as c on c.id = p.categoria_id
    where p.tienda_id = p_tienda
      and lower(btrim(p.nombre)) = lower(v_nombre)
      and (
        v_categoria = ''
        or lower(btrim(coalesce(c.nombre, ''))) = lower(v_categoria)
      );

    if coincidencias = 0 then
      raise exception 'Línea %: No encontré el producto.', linea;
    end if;
    if coincidencias > 1 then
      raise exception 'Línea %: Hay más de un producto con ese nombre.', linea;
    end if;

    select p.id
    into v_producto
    from public.productos as p
    left join public.categorias as c on c.id = p.categoria_id
    where p.tienda_id = p_tienda
      and lower(btrim(p.nombre)) = lower(v_nombre)
      and (
        v_categoria = ''
        or lower(btrim(coalesce(c.nombre, ''))) = lower(v_categoria)
      );

    select ps.stock
    into actual
    from public.producto_sucursal as ps
    where ps.producto_id = v_producto
      and ps.sucursal_id = v_sucursal
      and ps.tienda_id = p_tienda
    for update;

    if actual is null then
      raise exception 'Línea %: El producto no se ofrece en esa sucursal.', linea;
    end if;

    if actual <> stock_nuevo then
      perform public.ajustar_stock(
        v_sucursal,
        v_producto,
        stock_nuevo,
        'ajuste',
        'Importación CSV',
        p_user
      );
    end if;

    update public.producto_sucursal
    set stock_minimo = minimo_nuevo
    where producto_id = v_producto
      and sucursal_id = v_sucursal;

    aplicadas := aplicadas + 1;
  end loop;

  return aplicadas;
end;
$$;

revoke all on function public.ajustar_stock(uuid, uuid, integer, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.fijar_stock_minimo(uuid, uuid, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.transferir_stock(uuid, uuid, uuid, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.importar_stock(uuid, jsonb, uuid[], uuid)
  from public, anon, authenticated;

grant execute on function public.ajustar_stock(uuid, uuid, integer, text, text, uuid) to service_role;
grant execute on function public.fijar_stock_minimo(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.transferir_stock(uuid, uuid, uuid, integer, uuid) to service_role;
grant execute on function public.importar_stock(uuid, jsonb, uuid[], uuid) to service_role;
