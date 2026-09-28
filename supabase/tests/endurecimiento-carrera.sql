-- Una sola unidad. Dos compras a la vez: solo una puede pasar.
-- Este archivo deja los datos confirmados. El script lo corre en una base local
-- que se borra al terminar.

insert into public.tiendas (id, slug, nombre) values
  ('c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0', 'carrera', 'Carrera');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Básico'
where t.slug = 'carrera';

insert into public.sucursales (
  id, tienda_id, slug, nombre, abierta, acepta_recojo, activa, horario
) values (
  'c0c0c0c0-0001-4001-8001-000000000001',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'carrera',
  'Carrera',
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
);

insert into public.categorias (id, tienda_id, nombre) values
  (
    'c0c0c0c0-0002-4002-8002-000000000002',
    'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
    'Unidades'
  );

select public.crear_producto(
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'Ultima unidad',
  null,
  'c0c0c0c0-0002-4002-8002-000000000002',
  15,
  array['c0c0c0c0-0001-4001-8001-000000000001']::uuid[],
  null
);

select public.ajustar_stock(
  'c0c0c0c0-0001-4001-8001-000000000001',
  (select id from public.productos where nombre = 'Ultima unidad'),
  1,
  'entrada',
  'Carga',
  null
);
