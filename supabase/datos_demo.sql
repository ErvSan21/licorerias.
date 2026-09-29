-- Datos de demostración para demo-centro y demo-cadena:
-- 8 productos en 7 categorías, stock en cada sucursal y pedidos de los últimos 7 días.
-- Requiere supabase/seed.sql (las tiendas tienen que existir).
-- Si una tienda ya tiene "Cerveza Paceña x6", no la toca: se puede ejecutar dos veces.
-- supabase db push no ejecuta este archivo.
-- Uso: pégalo en el SQL editor de Supabase, o
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/datos_demo.sql

do $$
declare
  tienda record;
  suc record;
  prod record;
  linea record;
  sucursales uuid[];
  categoria uuid;
  producto uuid;
  pedido uuid;
  hoy date := (now() at time zone 'America/La_Paz')::date;
  dia integer;
  n integer;
  i integer;
  momento timestamptz;
  tipo text;
  estado text;
  pasos text[];
  paso integer;
  km numeric;
  envio numeric;
  subtotal numeric;
  descuento numeric;
  base_lat double precision;
  base_lng double precision;
  clientes text[] := array[
    'Marcos Quispe', 'Lucía Mamani', 'Diego Rojas', 'Carla Vargas', 'Andrés Flores',
    'Sofía Gutiérrez', 'Jorge Choque', 'Valeria Cruz', 'Luis Torrez', 'Paola Limachi',
    'Ricardo Salazar', 'Daniela Poma', 'Fernando Ticona', 'Camila Aliaga', 'Óscar Huanca'
  ];
  calles text[] := array[
    'Av. América 450', 'Calle Tarija 77', 'Av. 6 de Agosto 2100', 'Calle Jaén 12',
    'Av. Arce 1830', 'Calle 21 de Calacoto 8150', 'Av. Busch 1400', 'Calle México 118'
  ];
begin
  create temp table if not exists demo_productos (
    nombre text, categoria text, precio numeric, peso numeric
  ) on commit drop;
  truncate demo_productos;
  -- peso: qué tan seguido aparece en los pedidos.
  insert into demo_productos values
    ('Singani Casa Real', 'Singani', 120, 3),
    ('Vino Tannat Reserva', 'Vinos', 95, 2),
    ('Cerveza Paceña x6', 'Cervezas', 48, 6),
    ('Ron Havana Club', 'Rones', 150, 1),
    ('Whisky Old Parr 12', 'Whisky', 320, 1),
    ('Fernet Branca 750', 'Fernet', 110, 4),
    ('Espumante Brut', 'Vinos', 85, 1.5),
    ('Gin Bombay', 'Gin', 180, 1);

  create temp table if not exists demo_lineas (
    producto_id uuid, cantidad integer, nombre text,
    precio_original numeric, precio_unitario numeric, origen_precio text
  ) on commit drop;

  for tienda in
    select t.id, t.slug from public.tiendas as t
    where t.slug in ('demo-centro', 'demo-cadena')
    order by t.slug
  loop
    if exists (
      select 1 from public.productos as p
      where p.tienda_id = tienda.id and p.nombre = 'Cerveza Paceña x6'
    ) then
      raise notice 'La tienda % ya tiene datos de demostración.', tienda.slug;
      continue;
    end if;

    select array_agg(s.id order by s.orden) into sucursales
    from public.sucursales as s
    where s.tienda_id = tienda.id and s.activa;
    if sucursales is null then
      raise notice 'La tienda % no tiene sucursales activas.', tienda.slug;
      continue;
    end if;

    -- Catálogo y stock inicial.
    for prod in select * from demo_productos loop
      select c.id into categoria
      from public.categorias as c
      where c.tienda_id = tienda.id and lower(c.nombre) = lower(prod.categoria);
      if categoria is null then
        insert into public.categorias (tienda_id, nombre)
        values (tienda.id, prod.categoria)
        returning id into categoria;
      end if;

      producto := public.crear_producto(tienda.id, prod.nombre, null, categoria, prod.precio, sucursales, null);
      for i in 1 .. array_length(sucursales, 1) loop
        perform public.ajustar_stock(sucursales[i], producto, 250, 'entrada', 'Carga inicial (demo)', null);
      end loop;
    end loop;

    -- Pedidos de los últimos 7 días (hoy incluido).
    for suc in
      select s.id, s.lat, s.lng, s.orden from public.sucursales as s
      where s.id = any (sucursales)
    loop
      base_lat := coalesce(suc.lat, -16.5);
      base_lng := coalesce(suc.lng, -68.15);

      for dia in 0 .. 6 loop
        -- Más pedidos el fin de semana; la primera sucursal vende más.
        n := 4 + floor(random() * 5)::integer
          + case when extract(isodow from hoy - dia) in (5, 6) then 4 else 0 end
          - least(suc.orden, 2);
        if dia = 0 then
          n := greatest(3, n / 2);
        end if;

        for i in 1 .. n loop
          momento := ((hoy - dia) + time '10:00' + (random() * interval '12 hours'))
            at time zone 'America/La_Paz';
          if momento > now() - interval '5 minutes' then
            momento := now() - (random() * interval '3 hours') - interval '5 minutes';
          end if;
          tipo := case when random() < 0.65 then 'delivery' else 'recojo' end;

          if dia = 0 and i <= 4 then
            estado := (array['pendiente', 'pendiente', 'aceptado', 'listo'])[i];
          elsif random() < 0.1 then
            estado := 'cancelado';
          else
            estado := case when tipo = 'delivery' then 'enviado' else 'listo' end;
          end if;

          -- 1 a 3 productos distintos, con más chance para los de mayor peso.
          truncate demo_lineas;
          insert into demo_lineas (producto_id, cantidad, nombre, precio_original, precio_unitario, origen_precio)
          select p.id,
            1 + floor(random() * case when d.peso >= 4 then 3 else 2 end)::integer,
            p.nombre,
            (public.precio_vigente(p.id, suc.id) ->> 'precio_original')::numeric,
            (public.precio_vigente(p.id, suc.id) ->> 'precio_final')::numeric,
            public.precio_vigente(p.id, suc.id) ->> 'origen_precio'
          from public.productos as p
          join demo_productos as d on d.nombre = p.nombre
          where p.tienda_id = tienda.id
          order by -ln(greatest(random(), 1e-9)) / d.peso
          limit 1 + floor(random() * 3)::integer;

          select coalesce(sum(l.precio_unitario * l.cantidad), 0),
            coalesce(sum((l.precio_original - l.precio_unitario) * l.cantidad), 0)
          into subtotal, descuento
          from demo_lineas as l;

          if tipo = 'delivery' then
            km := round((0.4 + random() * 4.5)::numeric, 1);
            envio := case when km <= 1 then 7 when km <= 2 then 10 when km <= 4 then 15 else 20 end;
          else
            km := 0;
            envio := 0;
          end if;

          insert into public.pedidos (
            tienda_id, sucursal_id, cliente_nombre, telefono, tipo_entrega,
            lat, lng, direccion, direccion_referencia, distancia_km,
            subtotal, costo_envio, descuento, total, hora_recojo, estado, creado_en
          ) values (
            tienda.id,
            suc.id,
            clientes[1 + floor(random() * array_length(clientes, 1))::integer],
            '5917' || lpad(floor(random() * 10000000)::integer::text, 7, '0'),
            tipo,
            case when tipo = 'delivery' then base_lat + (random() - 0.5) * 0.04 end,
            case when tipo = 'delivery' then base_lng + (random() - 0.5) * 0.04 end,
            case when tipo = 'delivery' then calles[1 + floor(random() * array_length(calles, 1))::integer] else '' end,
            case when tipo = 'delivery' and random() < 0.4 then 'Portón negro' end,
            km,
            subtotal,
            envio,
            descuento,
            subtotal + envio,
            case when tipo = 'recojo' then momento + interval '45 minutes' end,
            estado,
            momento
          )
          returning id into pedido;

          insert into public.pedido_items (
            pedido_id, producto_id, tienda_id, nombre_producto, cantidad,
            precio_original, precio_unitario, origen_precio
          )
          select pedido, l.producto_id, tienda.id, l.nombre, l.cantidad,
            l.precio_original, l.precio_unitario, l.origen_precio
          from demo_lineas as l;

          -- Historial con la misma secuencia que sigue el panel.
          pasos := case
            when estado = 'cancelado' then array['pendiente', 'cancelado']
            else (array['pendiente', 'aceptado', 'listo', 'enviado'])[
              1 : array_position(array['pendiente', 'aceptado', 'listo', 'enviado'], estado)
            ]
          end;
          for paso in 1 .. array_length(pasos, 1) loop
            insert into public.pedido_historial (pedido_id, tienda_id, estado, user_id, creado_en)
            values (pedido, tienda.id, pasos[paso], null, momento + (paso - 1) * interval '12 minutes');
          end loop;

          if estado <> 'cancelado' then
            for linea in select l.producto_id, l.cantidad from demo_lineas as l loop
              perform public.ajustar_stock(suc.id, linea.producto_id, linea.cantidad, 'venta', 'Pedido (demo)', null);
            end loop;
          end if;
        end loop;
      end loop;
    end loop;

    -- Stock realista: la mayoría con buen nivel, algunos bajos o agotados.
    for suc in select s.id, s.orden from public.sucursales as s where s.id = any (sucursales) loop
      for prod in
        select p.id, p.nombre from public.productos as p
        where p.tienda_id = tienda.id
      loop
        perform public.ajustar_stock(
          suc.id,
          prod.id,
          case
            when prod.nombre = 'Ron Havana Club' and suc.orden = 0 then 3
            when prod.nombre = 'Gin Bombay' and suc.orden = 0 then 2
            when prod.nombre = 'Espumante Brut' then 0
            when prod.nombre = 'Cerveza Paceña x6' then 40 + floor(random() * 30)::integer
            else 8 + floor(random() * 20)::integer
          end,
          'ajuste',
          'Inventario de demostración',
          null
        );
      end loop;
    end loop;

    raise notice 'Datos de demostración creados en %.', tienda.slug;
  end loop;
end
$$;
