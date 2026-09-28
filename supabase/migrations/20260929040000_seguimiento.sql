-- Seguimiento público de un pedido. Solo el servidor. No abre lectura de pedidos a anon.

create or replace function public.seguimiento_pedido(p_slug text, p_pedido uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tienda public.tiendas%rowtype;
  ped public.pedidos%rowtype;
  sucursal_nombre text;
  items jsonb;
begin
  if p_pedido is null then
    raise exception 'Pedido no encontrado.';
  end if;

  select * into tienda from public.tiendas where slug = p_slug;
  if not found then
    raise exception 'Tienda no encontrada.';
  end if;

  perform public.exigir_licencia_vigente(tienda.id);

  select * into ped
  from public.pedidos
  where id = p_pedido
    and tienda_id = tienda.id;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;

  select nombre into sucursal_nombre from public.sucursales where id = ped.sucursal_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nombre', item.nombre_producto,
        'cantidad', item.cantidad,
        'precioUnitario', item.precio_unitario
      )
      order by item.nombre_producto
    ),
    '[]'::jsonb
  )
  into items
  from public.pedido_items as item
  where item.pedido_id = ped.id;

  return jsonb_build_object(
    'id', ped.id,
    'estado', ped.estado,
    'tipoEntrega', ped.tipo_entrega,
    'sucursal', coalesce(sucursal_nombre, 'Sucursal'),
    'total', ped.total,
    'subtotal', ped.subtotal,
    'costoEnvio', ped.costo_envio,
    'descuento', ped.descuento,
    'horaRecojo', ped.hora_recojo,
    'direccion', coalesce(ped.direccion, ''),
    'referencia', coalesce(ped.direccion_referencia, ''),
    'items', items,
    'creadoEn', ped.creado_en
  );
end;
$$;

revoke all on function public.seguimiento_pedido(text, uuid) from public, anon, authenticated;
grant execute on function public.seguimiento_pedido(text, uuid) to service_role;
