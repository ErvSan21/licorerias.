-- Precios de los tres plazos de suscripción. El servicio los lee y
-- los guarda con service role después de comprobar super admin.

create table public.precios_suscripcion (
  clave text primary key,
  precio numeric(10, 2) not null,
  constraint precios_suscripcion_clave check (clave in ('mes', 'tres_meses', 'anio')),
  constraint precios_suscripcion_precio check (precio >= 0)
);

insert into public.precios_suscripcion (clave, precio)
values
  ('mes', 0),
  ('tres_meses', 0),
  ('anio', 0);

alter table public.precios_suscripcion enable row level security;

revoke all on table public.precios_suscripcion from public, anon, authenticated;
grant select on table public.precios_suscripcion to authenticated;
grant all on table public.precios_suscripcion to service_role;

create policy precios_suscripcion_select on public.precios_suscripcion
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.super_admins as s
      where s.user_id = (select auth.uid())
    )
  );
