-- Reportes de la tienda. Solo el servidor los ejecuta.
-- El rango es inclusive, en America/La_Paz. El inventario es el valor actual.

create or replace function public.reporte_tienda(
  p_tienda uuid,
  p_sucursales uuid[],
  p_desde date,
  p_hasta date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inicio timestamptz;
  fin timestamptz;
  ventas numeric;
  pedidos integer;
  cancelados integer;
  monto_cancelado numeric;
  sucursales jsonb;
  categorias jsonb;
  productos jsonb;
  mas_vendido jsonb;
  menos_vendido jsonb;
  entregas jsonb;
  dias jsonb;
  horas jsonb;
  origenes jsonb;
  personal jsonb;
  inventario jsonb;
begin
  if p_hasta < p_desde then
    raise exception 'El rango de fechas no es válido.';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El rango no puede pasar de un año.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_sucursales, array[]::uuid[])) as pedida(id)
    where not exists (
      select 1 from public.sucursales as s
      where s.id = pedida.id and s.tienda_id = p_tienda
    )
  ) then
    raise exception 'La sucursal no pertenece a la tienda.';
  end if;

  inicio := p_desde::timestamp at time zone 'America/La_Paz';
  fin := (p_hasta + 1)::timestamp at time zone 'America/La_Paz';

  select
    coalesce(sum(total) filter (where estado <> 'cancelado'), 0),
    count(*) filter (where estado <> 'cancelado'),
    count(*) filter (where estado = 'cancelado'),
    coalesce(sum(total) filter (where estado = 'cancelado'), 0)
  into ventas, pedidos, cancelados, monto_cancelado
  from public.pedidos
  where tienda_id = p_tienda
    and sucursal_id = any(p_sucursales)
    and creado_en >= inicio
    and creado_en < fin;

  select coalesce(jsonb_agg(fila.dato order by fila.orden, fila.nombre), '[]'::jsonb)
  into sucursales
  from (
    select
      s.orden,
      s.nombre,
      jsonb_build_object(
        'id', s.id,
        'nombre', s.nombre,
        'ventas', coalesce(sum(p.total) filter (where p.estado <> 'cancelado'), 0),
        'pedidos', count(p.id) filter (where p.estado <> 'cancelado')
      ) as dato
    from public.sucursales as s
    left join public.pedidos as p
      on p.sucursal_id = s.id
      and p.creado_en >= inicio
      and p.creado_en < fin
    where s.id = any(p_sucursales)
    group by s.id, s.nombre, s.orden
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.ventas desc, fila.nombre), '[]'::jsonb)
  into categorias
  from (
    select
      coalesce(c.nombre, 'Sin categoría') as nombre,
      sum(i.cantidad * i.precio_unitario) as ventas,
      jsonb_build_object(
        'nombre', coalesce(c.nombre, 'Sin categoría'),
        'ventas', sum(i.cantidad * i.precio_unitario),
        'unidades', sum(i.cantidad)
      ) as dato
    from public.pedido_items as i
    join public.pedidos as p on p.id = i.pedido_id
    join public.productos as pr on pr.id = i.producto_id
    left join public.categorias as c on c.id = pr.categoria_id
    where p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and p.estado <> 'cancelado'
      and p.creado_en >= inicio
      and p.creado_en < fin
    group by coalesce(c.nombre, 'Sin categoría')
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.unidades desc, fila.nombre), '[]'::jsonb)
  into productos
  from (
    select
      i.nombre_producto as nombre,
      sum(i.cantidad) as unidades,
      jsonb_build_object(
        'nombre', i.nombre_producto,
        'unidades', sum(i.cantidad),
        'ventas', sum(i.cantidad * i.precio_unitario)
      ) as dato
    from public.pedido_items as i
    join public.pedidos as p on p.id = i.pedido_id
    where p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and p.estado <> 'cancelado'
      and p.creado_en >= inicio
      and p.creado_en < fin
    group by i.nombre_producto
    order by sum(i.cantidad) desc, i.nombre_producto
    limit 50
  ) as fila;

  select fila.dato into mas_vendido
  from (
    select jsonb_build_object('nombre', i.nombre_producto, 'unidades', sum(i.cantidad)) as dato
    from public.pedido_items as i
    join public.pedidos as p on p.id = i.pedido_id
    where p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and p.estado <> 'cancelado'
      and p.creado_en >= inicio
      and p.creado_en < fin
    group by i.nombre_producto
    order by sum(i.cantidad) desc, i.nombre_producto
    limit 1
  ) as fila;

  select fila.dato into menos_vendido
  from (
    select jsonb_build_object('nombre', i.nombre_producto, 'unidades', sum(i.cantidad)) as dato
    from public.pedido_items as i
    join public.pedidos as p on p.id = i.pedido_id
    where p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and p.estado <> 'cancelado'
      and p.creado_en >= inicio
      and p.creado_en < fin
    group by i.nombre_producto
    order by sum(i.cantidad), i.nombre_producto
    limit 1
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.tipo), '[]'::jsonb)
  into entregas
  from (
    select
      tipos.tipo,
      jsonb_build_object(
        'tipo', tipos.tipo,
        'pedidos', count(p.id),
        'ventas', coalesce(sum(p.total), 0)
      ) as dato
    from (values ('delivery'), ('recojo')) as tipos(tipo)
    left join public.pedidos as p
      on p.tipo_entrega = tipos.tipo
      and p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and p.estado <> 'cancelado'
      and p.creado_en >= inicio
      and p.creado_en < fin
    group by tipos.tipo
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.dia), '[]'::jsonb)
  into dias
  from (
    select
      serie.dia,
      jsonb_build_object(
        'dia', serie.dia,
        'pedidos', coalesce(conteo.pedidos, 0),
        'ventas', coalesce(conteo.ventas, 0)
      ) as dato
    from generate_series(0, 6) as serie(dia)
    left join (
      select
        extract(dow from creado_en at time zone 'America/La_Paz')::int as dia,
        count(*) as pedidos,
        sum(total) as ventas
      from public.pedidos
      where tienda_id = p_tienda
        and sucursal_id = any(p_sucursales)
        and estado <> 'cancelado'
        and creado_en >= inicio
        and creado_en < fin
      group by 1
    ) as conteo on conteo.dia = serie.dia
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.hora), '[]'::jsonb)
  into horas
  from (
    select
      extract(hour from creado_en at time zone 'America/La_Paz')::int as hora,
      jsonb_build_object(
        'hora', extract(hour from creado_en at time zone 'America/La_Paz')::int,
        'pedidos', count(*)
      ) as dato
    from public.pedidos
    where tienda_id = p_tienda
      and sucursal_id = any(p_sucursales)
      and estado <> 'cancelado'
      and creado_en >= inicio
      and creado_en < fin
    group by 1
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.origen), '[]'::jsonb)
  into origenes
  from (
    select
      origenes_base.origen,
      jsonb_build_object(
        'origen', origenes_base.origen,
        'ventas', coalesce(sum(i.cantidad * i.precio_unitario), 0)
      ) as dato
    from (values ('central'), ('propio'), ('oferta')) as origenes_base(origen)
    left join public.pedido_items as i
      on i.origen_precio = origenes_base.origen
      and exists (
        select 1
        from public.pedidos as p
        where p.id = i.pedido_id
          and p.tienda_id = p_tienda
          and p.sucursal_id = any(p_sucursales)
          and p.estado <> 'cancelado'
          and p.creado_en >= inicio
          and p.creado_en < fin
      )
    group by origenes_base.origen
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.cambios desc, fila.usuario), '[]'::jsonb)
  into personal
  from (
    select
      coalesce(u.email, 'Sin usuario') as usuario,
      count(*) as cambios,
      jsonb_build_object(
        'usuario', coalesce(u.email, 'Sin usuario'),
        'cambios', count(*)
      ) as dato
    from public.pedido_historial as h
    join public.pedidos as p on p.id = h.pedido_id
    left join auth.users as u on u.id = h.user_id
    where p.tienda_id = p_tienda
      and p.sucursal_id = any(p_sucursales)
      and h.estado <> 'pendiente'
      and h.creado_en >= inicio
      and h.creado_en < fin
    group by coalesce(u.email, 'Sin usuario')
  ) as fila;

  select coalesce(jsonb_agg(fila.dato order by fila.nombre), '[]'::jsonb)
  into inventario
  from (
    select
      s.nombre,
      jsonb_build_object(
        'id', s.id,
        'nombre', s.nombre,
        'valor', coalesce(sum(
          ps.stock * case
            when ps.usa_precio_central then pr.precio_central
            else ps.precio_propio
          end
        ), 0)
      ) as dato
    from public.sucursales as s
    left join public.producto_sucursal as ps
      on ps.sucursal_id = s.id
      and ps.disponible
    left join public.productos as pr
      on pr.id = ps.producto_id
      and pr.activo
    where s.id = any(p_sucursales)
    group by s.id, s.nombre
  ) as fila;

  return jsonb_build_object(
    'ventas', ventas,
    'pedidos', pedidos,
    'ticket', case when pedidos = 0 then 0 else round(ventas / pedidos, 2) end,
    'cancelados', cancelados,
    'montoCancelado', monto_cancelado,
    'sucursales', sucursales,
    'categorias', categorias,
    'productos', productos,
    'masVendido', mas_vendido,
    'menosVendido', menos_vendido,
    'entregas', entregas,
    'dias', dias,
    'horas', horas,
    'origenes', origenes,
    'personal', personal,
    'inventario', inventario
  );
end;
$$;

revoke all on function public.reporte_tienda(uuid, uuid[], date, date) from public, anon, authenticated;
grant execute on function public.reporte_tienda(uuid, uuid[], date, date) to service_role;
