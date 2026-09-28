-- Dos tiendas de demostración con licencia vigente.
-- demo-centro: una sucursal, siempre precio central.
-- demo-cadena: tres sucursales. Centro y Sur usan el precio central.
-- Norte tiene precio propio.
-- No cambia otras tiendas ni abre una licencia suspendida.
-- supabase db push no ejecuta este archivo.
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql

do $$
declare
  centro uuid;
  cadena uuid;
  suc_unica uuid;
  suc_centro uuid;
  suc_norte uuid;
  suc_sur uuid;
  cat_centro uuid;
  cat_cadena uuid;
  producto uuid;
  horario jsonb := '{
    "lun":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "mar":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "mie":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "jue":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "vie":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "sab":{"abierto":true,"desde":"00:00","hasta":"24:00"},
    "dom":{"abierto":true,"desde":"00:00","hasta":"24:00"}
  }'::jsonb;
  existentes integer;
begin
  select count(*) into existentes
  from public.tiendas
  where slug in ('demo-centro', 'demo-cadena');

  if existentes = 2 then
    return;
  end if;
  if existentes <> 0 then
    raise exception 'La semilla quedó a medias. Revisa demo-centro y demo-cadena.';
  end if;

  insert into public.tiendas (slug, nombre, estado)
  values ('demo-centro', 'Demo Centro', 'activa')
  returning id into centro;

  insert into public.tiendas (slug, nombre, estado)
  values ('demo-cadena', 'Demo Cadena', 'activa')
  returning id into cadena;

  insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
  select centro, p.id, 'activa',
    (now() at time zone 'America/La_Paz')::date,
    (now() at time zone 'America/La_Paz')::date + 365,
    3
  from public.planes as p
  where p.nombre = 'Básico';

  insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
  select cadena, p.id, 'activa',
    (now() at time zone 'America/La_Paz')::date,
    (now() at time zone 'America/La_Paz')::date + 365,
    3
  from public.planes as p
  where p.nombre = 'Pro';

  insert into public.sucursales (
    tienda_id, slug, nombre, direccion, lat, lng, horario, abierta, acepta_delivery, acepta_recojo, activa, orden
  ) values (
    centro, 'centro', 'Centro', 'Av. Demo 100', -16.5, -68.15, horario, true, true, true, true, 0
  )
  returning id into suc_unica;

  insert into public.sucursales (
    tienda_id, slug, nombre, direccion, lat, lng, horario, abierta, acepta_delivery, acepta_recojo, activa, orden
  ) values
    (cadena, 'centro', 'Centro', 'Av. Cadena 1', -16.5, -68.15, horario, true, true, true, true, 0),
    (cadena, 'norte', 'Norte', 'Av. Cadena 2', -16.49, -68.14, horario, true, true, true, true, 1),
    (cadena, 'sur', 'Sur', 'Av. Cadena 3', -16.51, -68.16, horario, true, true, true, true, 2);

  select id into suc_centro from public.sucursales where tienda_id = cadena and slug = 'centro';
  select id into suc_norte from public.sucursales where tienda_id = cadena and slug = 'norte';
  select id into suc_sur from public.sucursales where tienda_id = cadena and slug = 'sur';

  insert into public.categorias (tienda_id, nombre) values (centro, 'Licores') returning id into cat_centro;
  insert into public.categorias (tienda_id, nombre) values (cadena, 'Cervezas') returning id into cat_cadena;

  perform public.crear_producto(
    centro, 'Singani', null, cat_centro, 80, array[suc_unica], null
  );
  perform public.ajustar_stock(suc_unica, (
    select id from public.productos where tienda_id = centro and nombre = 'Singani'
  ), 12, 'entrada', 'Carga inicial', null);

  producto := public.crear_producto(
    cadena,
    'Paceña',
    null,
    cat_cadena,
    22,
    array[suc_centro, suc_norte, suc_sur],
    null
  );

  perform public.guardar_precio_sucursal(cadena, producto, suc_norte, false, 18, null);

  perform public.ajustar_stock(suc_centro, producto, 10, 'entrada', 'Carga inicial', null);
  perform public.ajustar_stock(suc_norte, producto, 10, 'entrada', 'Carga inicial', null);
  perform public.ajustar_stock(suc_sur, producto, 10, 'entrada', 'Carga inicial', null);

  perform public.exigir_licencia_vigente(centro);
  perform public.exigir_licencia_vigente(cadena);
end
$$;
