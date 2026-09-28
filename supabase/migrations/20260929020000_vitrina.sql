-- Vitrina pública. No devuelve el stock exacto ni acepta precios del navegador.

create or replace function public.abierta_ahora(
  p_abierta boolean,
  p_horario jsonb,
  p_momento timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_ts timestamp;
  clave text;
  franja jsonb;
  hora_txt text;
begin
  if not coalesce(p_abierta, false) then
    return false;
  end if;
  local_ts := p_momento at time zone 'America/La_Paz';
  clave := (array['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'])[extract(dow from local_ts)::int + 1];
  franja := p_horario -> clave;
  hora_txt := to_char(local_ts, 'HH24:MI');
  return coalesce((franja ->> 'abierto')::boolean, false)
    and franja ->> 'desde' is not null
    and hora_txt >= (franja ->> 'desde')
    and hora_txt < (franja ->> 'hasta');
end;
$$;

create or replace function public.escaparate(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tienda public.tiendas%rowtype;
  sucursales jsonb;
begin
  select * into tienda from public.tiendas where slug = p_slug;
  if not found then
    raise exception 'Tienda no encontrada.';
  end if;
  perform public.exigir_licencia_vigente(tienda.id);

  select coalesce(jsonb_agg(fila.dato order by fila.orden, fila.nombre), '[]'::jsonb)
  into sucursales
  from (
    select
      s.orden,
      s.nombre,
      jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'nombre', s.nombre,
        'direccion', s.direccion,
        'lat', s.lat,
        'lng', s.lng,
        'abierta', s.abierta,
        'abiertaAhora', public.abierta_ahora(s.abierta, s.horario),
        'aceptaDelivery', s.acepta_delivery,
        'aceptaRecojo', s.acepta_recojo
      ) as dato
    from public.sucursales as s
    where s.tienda_id = tienda.id
      and s.activa
  ) as fila;

  return jsonb_build_object(
    'nombre', tienda.nombre,
    'slug', tienda.slug,
    'sucursales', sucursales
  );
end;
$$;

create or replace function public.vitrina_publica(p_tienda text, p_sucursal text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tienda public.tiendas%rowtype;
  suc public.sucursales%rowtype;
  productos jsonb;
  categorias jsonb;
  colecciones jsonb;
begin
  select * into tienda from public.tiendas where slug = p_tienda;
  if not found then
    raise exception 'Tienda no encontrada.';
  end if;
  perform public.exigir_licencia_vigente(tienda.id);

  select * into suc
  from public.sucursales as s
  where s.tienda_id = tienda.id
    and s.slug = p_sucursal
    and s.activa;
  if not found then
    raise exception 'Sucursal no encontrada.';
  end if;

  select coalesce(jsonb_agg(fila.dato order by fila.nombre), '[]'::jsonb)
  into productos
  from (
    select
      p.nombre,
      jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'descripcion', p.descripcion,
        'categoriaId', p.categoria_id,
        'imagenUrl', p.imagen_url,
        'precioOriginal', (vig.precio ->> 'precio_original')::numeric,
        'precioFinal', (vig.precio ->> 'precio_final')::numeric,
        'origen', vig.precio ->> 'origen_precio',
        'agotado', ps.stock <= 0
      ) as dato
    from public.producto_sucursal as ps
    join public.productos as p
      on p.id = ps.producto_id
      and p.tienda_id = tienda.id
      and p.activo
    join lateral (
      select public.precio_vigente(p.id, suc.id) as precio
    ) as vig on vig.precio is not null
    where ps.sucursal_id = suc.id
      and ps.disponible
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.orden, fila.nombre), '[]'::jsonb)
  into categorias
  from (
    select c.orden, c.nombre, jsonb_build_object('id', c.id, 'nombre', c.nombre) as dato
    from public.categorias as c
    where c.tienda_id = tienda.id
      and c.activa
      and exists (
        select 1
        from jsonb_array_elements(productos) as item
        where item ->> 'categoriaId' = c.id::text
      )
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.nombre), '[]'::jsonb)
  into colecciones
  from (
    select
      c.nombre,
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'imagenUrl', c.imagen_url,
        'productoIds', coalesce((
          select jsonb_agg(cp.producto_id order by cp.orden, cp.producto_id)
          from public.coleccion_productos as cp
          where cp.coleccion_id = c.id
            and cp.tienda_id = tienda.id
            and exists (
              select 1
              from jsonb_array_elements(productos) as item
              where item ->> 'id' = cp.producto_id::text
            )
        ), '[]'::jsonb)
      ) as dato
    from public.colecciones as c
    where c.tienda_id = tienda.id
      and c.activa
      and c.inicio <= now()
      and now() < c.fin
      and exists (
        select 1
        from public.coleccion_productos as cp
        where cp.coleccion_id = c.id
          and exists (
            select 1
            from jsonb_array_elements(productos) as item
            where item ->> 'id' = cp.producto_id::text
          )
      )
  ) as fila;

  return jsonb_build_object(
    'tienda', jsonb_build_object('nombre', tienda.nombre, 'slug', tienda.slug),
    'sucursal', jsonb_build_object(
      'id', suc.id,
      'slug', suc.slug,
      'nombre', suc.nombre,
      'direccion', suc.direccion,
      'lat', suc.lat,
      'lng', suc.lng,
      'abiertaAhora', public.abierta_ahora(suc.abierta, suc.horario),
      'aceptaDelivery', suc.acepta_delivery,
      'aceptaRecojo', suc.acepta_recojo,
      'minutosRecojo', suc.minutos_anticipacion_recojo,
      'horario', suc.horario
    ),
    'categorias', categorias,
    'productos', productos,
    'colecciones', colecciones
  );
end;
$$;

revoke all on function public.abierta_ahora(boolean, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.escaparate(text) from public, anon, authenticated;
revoke all on function public.vitrina_publica(text, text) from public, anon, authenticated;

grant execute on function public.abierta_ahora(boolean, jsonb, timestamptz) to service_role;
grant execute on function public.escaparate(text) to service_role;
grant execute on function public.vitrina_publica(text, text) to service_role;
