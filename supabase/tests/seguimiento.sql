-- Seguimiento público: un pedido por uuid, sin lectura anónima.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('44444444-4444-4444-8444-444444444444', 'carla@barril.test');

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barril-b', 'Barril B');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro';

insert into public.miembros (id, user_id, tienda_id, rol) values (
  'bbbb4444-4444-4444-8444-444444444444',
  '44444444-4444-4444-8444-444444444444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dueno'
);

insert into public.sucursales (
  id, tienda_id, slug, nombre, lat, lng, abierta, acepta_delivery, acepta_recojo, activa, horario
) values (
  'bbbb0001-0001-4001-8001-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'centro',
  'Centro B',
  -16.5,
  -68.15,
  true,
  true,
  true,
  true,
  '{
    "lun":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "mar":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "mie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "jue":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "vie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "sab":{"abierto":true,"desde":"00:00","hasta":"23:59"},
    "dom":{"abierto":true,"desde":"00:00","hasta":"23:59"}
  }'::jsonb
);

do $$
declare
  categoria uuid;
  producto uuid;
  pedido uuid;
  vista jsonb;
  n integer;
begin
  if has_function_privilege('anon', 'public.seguimiento_pedido(text, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.seguimiento_pedido(text, uuid)', 'execute')
    or has_function_privilege('public', 'public.seguimiento_pedido(text, uuid)', 'execute') then
    raise exception 'el seguimiento quedó ejecutable fuera del servidor';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos'
      and (roles && array['anon', 'public']::name[])
  ) then
    raise exception 'hay una política pública de lectura sobre pedidos';
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cervezas')
  returning id into categoria;

  producto := public.crear_producto(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Paceña',
    null,
    categoria,
    20,
    array['bbbb0001-0001-4001-8001-000000000001']::uuid[],
    '44444444-4444-4444-8444-444444444444'
  );

  perform public.ajustar_stock(
    'bbbb0001-0001-4001-8001-000000000001',
    producto,
    2,
    'entrada',
    'Carga',
    '44444444-4444-4444-8444-444444444444'
  );

  pedido := public.crear_pedido(
    'bbbb0001-0001-4001-8001-000000000001',
    'Ana Cliente',
    '59171234567',
    'recojo',
    null, null, null, null, 0, 0, null,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1))
  );

  vista := public.seguimiento_pedido('barril-b', pedido);
  if vista ->> 'estado' <> 'pendiente'
    or vista ->> 'tipoEntrega' <> 'recojo'
    or vista ->> 'sucursal' <> 'Centro B'
    or (vista ->> 'total')::numeric <> 20
    or jsonb_array_length(vista -> 'items') <> 1 then
    raise exception 'el seguimiento no devolvió el pedido %', vista;
  end if;

  if vista ? 'telefono' or vista ? 'lat' or vista ? 'lng' or vista ? 'tienda_id' or vista ? 'sucursal_id' then
    raise exception 'el seguimiento expone datos internos';
  end if;

  perform public.cambiar_estado(pedido, 'aceptado', '44444444-4444-4444-8444-444444444444');
  vista := public.seguimiento_pedido('barril-b', pedido);
  if vista ->> 'estado' <> 'aceptado' then
    raise exception 'el seguimiento no avanzó a aceptado';
  end if;

  begin
    perform public.seguimiento_pedido('esquina-a', pedido);
    raise exception 'otra tienda vio el pedido';
  exception
    when others then
      if sqlerrm not like '%no encontrad%' and sqlerrm not like '%no disponible%' then
        raise;
      end if;
  end;

  begin
    execute 'set local role anon';
    select count(*) into n from public.pedidos;
    raise exception 'anon leyó % pedidos', n;
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  update public.licencias
  set estado = 'suspendida'
  where tienda_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  begin
    perform public.seguimiento_pedido('barril-b', pedido);
    raise exception 'la licencia suspendida siguió mostrando el pedido';
  exception
    when others then
      if sqlerrm not like '%Tienda no disponible%' then
        raise;
      end if;
  end;
end
$$;

rollback;
