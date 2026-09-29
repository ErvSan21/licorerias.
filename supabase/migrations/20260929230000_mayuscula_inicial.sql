-- Primera letra en mayúscula en los nombres y textos ya guardados.
-- Los nuevos ya se guardan así desde la app (src/lib/texto.ts).

create or replace function pg_temp.capitalizar(valor text)
returns text
language sql
immutable
as $$
  select case
    when valor is null or valor = '' then valor
    else upper(left(valor, 1)) || substr(valor, 2)
  end;
$$;

update public.tiendas set nombre = pg_temp.capitalizar(nombre) where nombre <> pg_temp.capitalizar(nombre);

update public.sucursales
set nombre = pg_temp.capitalizar(nombre),
  direccion = pg_temp.capitalizar(direccion)
where nombre <> pg_temp.capitalizar(nombre) or direccion <> pg_temp.capitalizar(direccion);

update public.categorias set nombre = pg_temp.capitalizar(nombre) where nombre <> pg_temp.capitalizar(nombre);

update public.productos
set nombre = pg_temp.capitalizar(nombre),
  descripcion = pg_temp.capitalizar(descripcion)
where nombre <> pg_temp.capitalizar(nombre)
  or descripcion is distinct from pg_temp.capitalizar(descripcion);

update public.pedido_items
set nombre_producto = pg_temp.capitalizar(nombre_producto)
where nombre_producto <> pg_temp.capitalizar(nombre_producto);

update public.pedidos
set cliente_nombre = pg_temp.capitalizar(cliente_nombre),
  direccion = pg_temp.capitalizar(direccion),
  direccion_referencia = pg_temp.capitalizar(direccion_referencia)
where cliente_nombre <> pg_temp.capitalizar(cliente_nombre)
  or direccion <> pg_temp.capitalizar(direccion)
  or direccion_referencia is distinct from pg_temp.capitalizar(direccion_referencia);

update public.colecciones
set nombre = pg_temp.capitalizar(nombre),
  descripcion = pg_temp.capitalizar(descripcion)
where nombre <> pg_temp.capitalizar(nombre)
  or descripcion is distinct from pg_temp.capitalizar(descripcion);

update public.zonas_reparto set nombre = pg_temp.capitalizar(nombre) where nombre <> pg_temp.capitalizar(nombre);

update public.precios_suscripcion set nombre = pg_temp.capitalizar(nombre) where nombre <> pg_temp.capitalizar(nombre);
