-- Método de pago del pedido: QR o efectivo.
-- Los pedidos anteriores y los de la tienda pública quedan sin método (null).

alter table public.pedidos
  add column metodo_pago text;

alter table public.pedidos
  add constraint pedidos_metodo_pago check (metodo_pago is null or metodo_pago in ('qr', 'efectivo'));

-- Las sucursales creadas desde Administración pasan a abrir las 24 horas, todos los días.
update public.sucursales as s
set horario = '{
  "lun":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "mar":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "mie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "jue":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "vie":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "sab":{"abierto":true,"desde":"00:00","hasta":"23:59"},
  "dom":{"abierto":true,"desde":"00:00","hasta":"23:59"}
}'::jsonb
where s.slug = 'principal'
  and exists (
    select 1
    from public.auditoria as a
    where a.tienda_id = s.tienda_id
      and a.accion = 'administracion.tienda.crear'
  );
