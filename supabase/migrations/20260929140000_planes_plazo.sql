-- Planes de suscripción: mensual, trimestral, anual y demo.
-- Demo no tiene fecha de fin.

alter table public.precios_suscripcion
  drop constraint precios_suscripcion_clave;

update public.precios_suscripcion set clave = 'mensual' where clave = 'mes';
update public.precios_suscripcion set clave = 'trimestral' where clave = 'tres_meses';
update public.precios_suscripcion set clave = 'anual' where clave = 'anio';

insert into public.precios_suscripcion (clave, precio)
values ('demo', 0)
on conflict (clave) do nothing;

alter table public.precios_suscripcion
  add constraint precios_suscripcion_clave check (clave in ('mensual', 'trimestral', 'anual', 'demo'));

alter table public.licencias
  add column plazo text not null default 'mensual';

alter table public.licencias
  drop constraint licencias_fechas;

alter table public.licencias
  alter column vence drop not null;

alter table public.licencias
  add constraint licencias_plazo_valido check (plazo in ('mensual', 'trimestral', 'anual', 'demo')),
  add constraint licencias_vence_rango check (vence is null or vence >= inicio),
  add constraint licencias_demo_sin_fin check (
    (plazo = 'demo' and vence is null)
    or (plazo <> 'demo' and vence is not null)
  );

create or replace function public.licencia_vigente(p_tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiendas as t
    join public.licencias as l on l.tienda_id = t.id
    where t.id = p_tienda
      and t.estado = 'activa'
      and l.estado in ('prueba', 'activa')
      and (
        l.vence is null
        or (now() at time zone 'America/La_Paz')::date <= (l.vence + l.dias_gracia)
      )
  );
$$;
