import { redirect } from "next/navigation";

import { AccionesPedido, EtiquetaPago } from "@/components/panel/pedidos-panel";
import { BotonVolver } from "@/components/ui/boton-volver";
import { Tag } from "@/components/ui/tag";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import {
  etiquetaEntrega,
  etiquetaEstadoPedido,
  etiquetaMetodoPago,
  referenciaPedido,
  tonoEstadoPedido,
} from "@/lib/pedidos/reglas";
import { leerPedido } from "@/lib/pedidos/servicio";
import { normalizarSlug } from "@/lib/tenant";

const fecha = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const hora = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit" });

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string; pedidoId: string }>;
}) {
  const { slug, pedidoId } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/pedidos/${pedidoId}`)}`);
  }
  const [contexto, detalle] = await Promise.all([contextoPanel(normalizado), leerPedido(normalizado, pedidoId)]);
  const { pedido, vendedor, historial } = detalle;
  const creado = new Date(pedido.creadoEn);

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/pedidos`} etiqueta="Pedidos" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-pretty text-lg font-semibold">
            <span className="tabular-nums">#{referenciaPedido(pedido.id)}</span> · {pedido.cliente}
          </h2>
          <p className="text-sm text-[var(--mu)]">
            {pedido.origen === "panel" ? "Venta en el panel" : "Pedido de la tienda en línea"} · {pedido.sucursal}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Tag tono={tonoEstadoPedido(pedido.estado)}>{etiquetaEstadoPedido(pedido.estado, pedido.origen)}</Tag>
          <EtiquetaPago pedido={pedido} />
        </span>
      </div>

      <section className="dashboard-tarjeta" aria-labelledby="datos-pedido">
        <h3 id="datos-pedido">Detalle</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Dato titulo="Fecha" valor={fecha.format(creado)} />
          <Dato titulo="Hora" valor={hora.format(creado)} />
          {pedido.origen === "panel" ? <Dato titulo="Vendedor" valor={vendedor ?? "—"} ancho /> : null}
          <Dato titulo="Entrega" valor={etiquetaEntrega(pedido.tipo)} />
          <Dato titulo="Pago" valor={pedido.metodoPago ? etiquetaMetodoPago(pedido.metodoPago) : "—"} />
          {pedido.telefono ? <Dato titulo="Celular" valor={pedido.telefono} /> : null}
          {pedido.horaRecojo ? <Dato titulo="Hora de recojo" valor={formatoFechaPrecio(pedido.horaRecojo)} /> : null}
          {pedido.tipo === "delivery" ? (
            <Dato
              titulo="Dirección"
              valor={`${pedido.direccion}${pedido.referencia ? ` · ${pedido.referencia}` : ""} · ${pedido.distanciaKm} km`}
              ancho
            />
          ) : null}
        </dl>
      </section>

      <section className="dashboard-tarjeta" aria-labelledby="productos-pedido">
        <h3 id="productos-pedido">Productos</h3>
        <ul className="flex flex-col gap-2.5 text-sm">
          {pedido.items.map((item) => (
            <li key={item.productoId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="tabular-nums text-[var(--mu)]">{item.cantidad} ×</span> {item.nombre}
              </span>
              <span className="shrink-0 tabular-nums">{formatoBs(item.precioUnitario * item.cantidad)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t border-[var(--ln)] pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--mu)]">Subtotal</dt>
            <dd className="tabular-nums">{formatoBs(pedido.subtotal)}</dd>
          </div>
          {pedido.descuento > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--mu)]">Descuento</dt>
              <dd className="tabular-nums text-[var(--ok)]">−{formatoBs(pedido.descuento)}</dd>
            </div>
          ) : null}
          {pedido.tipo === "delivery" ? (
            <div className="flex justify-between">
              <dt className="text-[var(--mu)]">Envío</dt>
              <dd className="tabular-nums">{formatoBs(pedido.costoEnvio)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex items-center justify-between">
            <dt className="font-semibold">Total</dt>
            <dd className="font-display text-[17px] font-extrabold tabular-nums">{formatoBs(pedido.total)}</dd>
          </div>
        </dl>
      </section>

      <AccionesPedido slug={contexto.tienda.slug} pedido={pedido} lectura={!contexto.vigente} />

      <section className="dashboard-tarjeta" aria-labelledby="historial-pedido">
        <h3 id="historial-pedido">Historial de estados</h3>
        <ol className="flex flex-col">
          {historial.map((paso) => (
            <li key={`${paso.estado}-${paso.creadoEn}`} className="venta-paso" data-hecho="">
              <i aria-hidden="true" />
              <div className="min-w-0">
                <b>{etiquetaEstadoPedido(paso.estado, pedido.origen)}</b>
                <p className="text-xs text-[var(--mu)]">
                  <time dateTime={paso.creadoEn}>
                    {fecha.format(new Date(paso.creadoEn))} · {hora.format(new Date(paso.creadoEn))}
                  </time>
                  {" · "}
                  {paso.usuario ?? (pedido.origen === "tienda" && paso.estado === "pendiente" ? "Cliente en línea" : "—")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Dato({ titulo, valor, ancho = false }: { titulo: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? "col-span-2" : undefined}>
      <dt className="text-xs text-[var(--mu)]">{titulo}</dt>
      <dd className="break-words">{valor}</dd>
    </div>
  );
}
