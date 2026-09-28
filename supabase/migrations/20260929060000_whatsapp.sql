-- Credenciales de WhatsApp por tienda o sucursal, y el saludo de 12 horas.
-- El token va cifrado. No hay políticas: solo el servidor, con service_role.

create table public.credenciales_whatsapp (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  sucursal_id uuid references public.sucursales (id) on delete cascade,
  phone_number_id text not null,
  waba_id text not null,
  token_cifrado text not null,
  token_ultimos text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint credenciales_phone check (phone_number_id ~ '^[0-9]{6,32}$'),
  constraint credenciales_waba check (waba_id ~ '^[0-9]{6,32}$'),
  constraint credenciales_ultimos check (char_length(token_ultimos) = 4),
  constraint credenciales_token check (length(token_cifrado) >= 16)
);

create unique index credenciales_phone_idx on public.credenciales_whatsapp (phone_number_id);
create unique index credenciales_tienda_idx on public.credenciales_whatsapp (tienda_id) where sucursal_id is null;
create unique index credenciales_sucursal_idx on public.credenciales_whatsapp (sucursal_id) where sucursal_id is not null;

create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas (id) on delete cascade,
  telefono text not null,
  ultimo_saludo timestamptz not null default now(),
  constraint conversaciones_telefono check (telefono ~ '^[1-9][0-9]{7,14}$'),
  constraint conversaciones_unica unique (tienda_id, telefono)
);

alter table public.credenciales_whatsapp enable row level security;
alter table public.conversaciones enable row level security;

revoke all on table public.credenciales_whatsapp from public, anon, authenticated;
revoke all on table public.conversaciones from public, anon, authenticated;

grant all on table public.credenciales_whatsapp to service_role;
grant all on table public.conversaciones to service_role;
