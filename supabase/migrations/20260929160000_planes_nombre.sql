-- Nombre visible del precio. La clave sigue siendo la duración.

alter table public.precios_suscripcion
  add column nombre text;

update public.precios_suscripcion set nombre = 'Mensual' where clave = 'mensual';
update public.precios_suscripcion set nombre = 'Trimestral' where clave = 'trimestral';
update public.precios_suscripcion set nombre = 'Anual' where clave = 'anual';
update public.precios_suscripcion set nombre = 'Demo' where clave = 'demo';

alter table public.precios_suscripcion
  alter column nombre set not null;

alter table public.precios_suscripcion
  add constraint precios_suscripcion_nombre check (length(btrim(nombre)) > 0 and length(nombre) <= 40);
