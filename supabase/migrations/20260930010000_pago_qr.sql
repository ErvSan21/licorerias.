-- Cobro con QR y confirmación del pago de los pedidos de la tienda en línea.
-- Repetible: se puede ejecutar aunque ya esté aplicada.

-- Imagen del QR de cobro que el cliente ve al elegir "QR" en su pedido.
alter table public.configuracion_tienda
  add column if not exists qr_pago_url text;

alter table public.configuracion_tienda
  drop constraint if exists configuracion_qr_pago_url;
alter table public.configuracion_tienda
  add constraint configuracion_qr_pago_url check (
    qr_pago_url is null or char_length(qr_pago_url) between 8 and 500
  );

-- Cuándo y quién confirmó que el pedido está pagado (efectivo recibido o QR verificado).
alter table public.pedidos
  add column if not exists pago_confirmado_en timestamptz,
  add column if not exists pago_confirmado_por uuid references auth.users (id) on delete set null;

-- Las ventas del panel se cobran en el mostrador: quedan pagadas.
update public.pedidos
set pago_confirmado_en = creado_en
where origen = 'panel' and pago_confirmado_en is null;
