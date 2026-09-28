-- Aislamiento de sucursal, precios y pedido.
-- El cliente no elige el precio ni la tienda. El recojo ignora el envío enviado.
-- Corre dentro de una transacción y hace rollback.

begin;

insert into auth.users (id, email) values
  ('d1111111-1111-4111-8111-111111111111', 'dueno@endurecer.test'),
  ('d2222222-2222-4222-8222-222222222222', 'gerente@endurecer.test'),
  ('d3333333-3333-4333-8333-333333333333', 'vendedor@endurecer.test');

insert into public.tiendas (id, slug, nombre) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'endurecer', 'Endurecer'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'ajena', 'Ajena'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'cerrada-m13', 'Cerrada');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro'
where t.slug in ('endurecer', 'ajena');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'suspendida',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Básico'
where t.slug = 'cerrada-m13';

update public.tiendas set estado = 'suspendida' where slug = 'cerrada-m13';

insert into public.miembros (id, user_id, tienda_id, rol) values
  (
    'ddaa1111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'dueno'
  ),
  (
    'ddbb2222-2222-4222-8222-222222222222',
    'd2222222-2222-4222-8222-222222222222',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'gerente'
  ),
  (
    'ddcc3333-3333-4333-8333-333333333333',
    'd3333333-3333-4333-8333-333333333333',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'vendedor'
  );

insert into public.sucursales (
  id, tienda_id, slug, nombre, lat, lng, abierta, acepta_delivery, acepta_recojo, activa, horario
) values (
  'dddd0001-0001-4001-8001-000000000001',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'centro',
  'Centro',
  -16.5,
  -68.15,
  true,
  true,
  true,
  true,
  '{
    "lun":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "mar":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "mie":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "jue":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "vie":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "sab":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "dom":{"abierto":true,"desde":"00:00","hasta":"24:00"}
  }'::jsonb
), (
  'dddd0002-0002-4002-8002-000000000002',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'norte',
  'Norte',
  -16.4,
  -68.1,
  true,
  true,
  true,
  true,
  '{}'::jsonb
), (
  'eeee0001-0001-4001-8001-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'unica',
  'Única',
  -16.5,
  -68.15,
  true,
  false,
  true,
  true,
  '{}'::jsonb
);

insert into public.miembro_sucursales (miembro_id, sucursal_id) values
  ('ddbb2222-2222-4222-8222-222222222222', 'dddd0001-0001-4001-8001-000000000001'),
  ('ddcc3333-3333-4333-8333-333333333333', 'dddd0001-0001-4001-8001-000000000001');

-- Gerente de la sucursal 1 no toca la sucursal 2.
do $$
declare
  n int;
  nombre text;
begin
  perform set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  select count(*) into n from public.sucursales;
  if n <> 1 then
    raise exception 'el gerente ve % sucursales; se esperaba 1', n;
  end if;

  select s.slug into nombre from public.sucursales as s;
  if nombre <> 'centro' then
    raise exception 'el gerente ve la sucursal %', nombre;
  end if;

  select count(*) into n
  from public.sucursales
  where id = 'dddd0002-0002-4002-8002-000000000002';
  if n <> 0 then
    raise exception 'el gerente ve la sucursal 2';
  end if;

  begin
    update public.sucursales
    set nombre = 'robada'
    where id = 'dddd0002-0002-4002-8002-000000000002';
    if found then
      raise exception 'el gerente modificó la sucursal 2';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- El vendedor no cambia precios.
do $$
begin
  perform set_config('request.jwt.claim.sub', 'd3333333-3333-4333-8333-333333333333', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  begin
    update public.productos
    set precio_central = 1
    where tienda_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    raise exception 'el vendedor pudo actualizar productos';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.producto_sucursal
    set precio_propio = 1,
        usa_precio_central = false
    where sucursal_id = 'dddd0001-0001-4001-8001-000000000001';
    raise exception 'el vendedor pudo actualizar precios de sucursal';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.guardar_precio_sucursal(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'dddd0001-0001-4001-8001-000000000001',
      'dddd0001-0001-4001-8001-000000000001',
      false,
      1,
      'd3333333-3333-4333-8333-333333333333'
    );
    raise exception 'el vendedor ejecutó guardar_precio_sucursal';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.ajustar_precio_central_categoria(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'dddd0001-0001-4001-8001-000000000001',
      10,
      'd3333333-3333-4333-8333-333333333333'
    );
    raise exception 'el vendedor ejecutó un ajuste masivo';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

do $$
declare
  categoria uuid;
  ajena_categoria uuid;
  producto uuid;
  ajeno uuid;
  pedido uuid;
  unitario numeric;
  envio numeric;
  total numeric;
  tienda uuid;
  stock integer;
begin
  if exists (select 1 from public.tiendas where slug = 'esquina') then
    raise exception 'este ensayo no debe usar el slug esquina';
  end if;

  begin
    perform public.exigir_licencia_vigente('ffffffff-ffff-4fff-8fff-ffffffffffff');
    raise exception 'una licencia suspendida quedó vigente';
  exception
    when others then
      if sqlerrm <> 'Tienda no disponible.' then
        raise;
      end if;
  end;

  insert into public.categorias (tienda_id, nombre)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Cervezas')
  returning id into categoria;

  producto := public.crear_producto(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Paceña',
    null,
    categoria,
    25,
    array[
      'dddd0001-0001-4001-8001-000000000001',
      'dddd0002-0002-4002-8002-000000000002'
    ]::uuid[],
    'd1111111-1111-4111-8111-111111111111'
  );

  perform public.ajustar_stock(
    'dddd0001-0001-4001-8001-000000000001',
    producto,
    2,
    'entrada',
    'Carga',
    'd1111111-1111-4111-8111-111111111111'
  );

  pedido := public.crear_pedido(
    'dddd0001-0001-4001-8001-000000000001',
    'Ana Cliente',
    '59171234567',
    'recojo',
    -16.5,
    -68.15,
    'ignorada',
    null,
    99,
    99,
    null,
    jsonb_build_array(jsonb_build_object(
      'producto_id', producto,
      'cantidad', 1,
      'precio', 1,
      'tienda_id', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    ))
  );

  select pi.precio_unitario, p.costo_envio, p.total, p.tienda_id
    into unitario, envio, total, tienda
  from public.pedidos as p
  join public.pedido_items as pi on pi.pedido_id = p.id
  where p.id = pedido;

  if unitario <> 25 or total <> 25 or envio <> 0 then
    raise exception 'el pedido cobró precio % total % envío %', unitario, total, envio;
  end if;
  if tienda <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
    raise exception 'el pedido quedó en la tienda %', tienda;
  end if;

  select ps.stock into stock
  from public.producto_sucursal as ps
  where ps.producto_id = producto
    and ps.sucursal_id = 'dddd0001-0001-4001-8001-000000000001';
  if stock <> 1 then
    raise exception 'el pedido dejó stock %', stock;
  end if;

  insert into public.categorias (tienda_id, nombre)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Cervezas')
  returning id into ajena_categoria;

  ajeno := public.crear_producto(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'Ajena',
    null,
    ajena_categoria,
    10,
    array['eeee0001-0001-4001-8001-000000000001']::uuid[],
    null
  );

  begin
    perform public.crear_pedido(
      'dddd0001-0001-4001-8001-000000000001',
      'Ana Cliente',
      '59171234567',
      'recojo',
      null,
      null,
      '',
      null,
      0,
      0,
      null,
      jsonb_build_array(jsonb_build_object('producto_id', ajeno, 'cantidad', 1, 'precio', 1))
    );
    raise exception 'se vendió un producto de otra tienda';
  exception
    when others then
      if sqlerrm not like '%no se ofrece%' and sqlerrm not like '%no pertenece%' then
        raise;
      end if;
  end;
end
$$;

rollback;
