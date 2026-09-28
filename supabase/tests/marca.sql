-- Marca pública: una fila por tienda, sin precio ni escritura anónima.

begin;

insert into public.tiendas (id, slug, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'esquina-a', 'Esquina A');

insert into public.licencias (tienda_id, plan_id, estado, inicio, vence, dias_gracia)
select t.id, p.id, 'activa',
  (now() at time zone 'America/La_Paz')::date,
  (now() at time zone 'America/La_Paz')::date + 30,
  3
from public.tiendas as t
join public.planes as p on p.nombre = 'Pro';

do $$
declare
  vista jsonb;
  n integer;
begin
  if has_function_privilege('anon', 'public.marca_publica(text)', 'execute')
    or has_function_privilege('authenticated', 'public.marca_publica(text)', 'execute')
    or has_function_privilege('public', 'public.marca_publica(text)', 'execute') then
    raise exception 'la marca quedó ejecutable fuera del servidor';
  end if;

  update public.configuracion_tienda
  set nombre_comercial = 'La Esquina',
      color_primario = '#7f1d1d',
      mensaje_bienvenida = 'Pide por aquí'
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  vista := public.marca_publica('esquina-a');
  if vista ->> 'nombreComercial' <> 'La Esquina'
    or vista ->> 'colorPrimario' <> '#7f1d1d'
    or vista ->> 'mensajeBienvenida' <> 'Pide por aquí' then
    raise exception 'la marca pública no devolvió lo guardado %', vista;
  end if;

  if vista ? 'margen_max_porcentaje' or vista ? 'sucursales_pueden_fijar_precio' then
    raise exception 'la marca pública expone la configuración de precios';
  end if;

  begin
    update public.configuracion_tienda
    set color_primario = 'rojo'
    where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'aceptó un color inválido';
  exception
    when check_violation then
      null;
  end;

  begin
    execute 'set local role authenticated';
    update public.configuracion_tienda
    set nombre_comercial = 'Ajeno'
    where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'authenticated cambió la marca';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  update public.licencias
  set estado = 'suspendida'
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  begin
    perform public.marca_publica('esquina-a');
    raise exception 'la licencia suspendida siguió mostrando la marca';
  exception
    when others then
      if sqlerrm not like '%Tienda no disponible%' then
        raise;
      end if;
  end;

  select count(*) into n from public.configuracion_tienda
  where tienda_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if n <> 1 then
    raise exception 'la tienda no tiene una sola fila de configuración';
  end if;
end
$$;

rollback;
