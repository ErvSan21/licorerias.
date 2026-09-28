-- Marca de la tienda. El horario y la ubicación siguen en cada sucursal.
-- Las imágenes van en el bucket marca, ruta {tienda_id}/marca/...

alter table public.configuracion_tienda
  add column nombre_comercial text,
  add column logo_url text,
  add column color_primario text,
  add column banner_url text,
  add column mensaje_bienvenida text;

alter table public.configuracion_tienda
  add constraint configuracion_nombre_comercial check (
    nombre_comercial is null or char_length(btrim(nombre_comercial)) between 2 and 60
  ),
  add constraint configuracion_color check (
    color_primario is null or color_primario ~ '^#[0-9A-Fa-f]{6}$'
  ),
  add constraint configuracion_logo check (
    logo_url is null or char_length(logo_url) between 8 and 500
  ),
  add constraint configuracion_banner check (
    banner_url is null or char_length(banner_url) between 8 and 500
  ),
  add constraint configuracion_bienvenida check (
    mensaje_bienvenida is null or char_length(btrim(mensaje_bienvenida)) between 2 and 280
  );

create or replace function public.marca_publica(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tienda public.tiendas%rowtype;
  cfg public.configuracion_tienda%rowtype;
begin
  select * into tienda from public.tiendas where slug = p_slug;
  if not found then
    raise exception 'Tienda no encontrada.';
  end if;
  perform public.exigir_licencia_vigente(tienda.id);
  select * into cfg from public.configuracion_tienda where tienda_id = tienda.id;
  return jsonb_build_object(
    'nombreComercial', cfg.nombre_comercial,
    'logoUrl', cfg.logo_url,
    'colorPrimario', cfg.color_primario,
    'bannerUrl', cfg.banner_url,
    'mensajeBienvenida', cfg.mensaje_bienvenida
  );
end;
$$;

revoke all on function public.marca_publica(text) from public, anon, authenticated;
grant execute on function public.marca_publica(text) to service_role;

-- En Postgres local no existe el esquema storage: ahí no se crea el bucket.
do $storage$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('marca', 'marca', true)
  on conflict (id) do update set public = excluded.public;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'marca_lectura_publica'
  ) then
    create policy marca_lectura_publica on storage.objects
      for select
      to public
      using (bucket_id = 'marca');
  end if;
end
$storage$;
