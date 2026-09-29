import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import { formatoBs } from "@/lib/catalogo/reglas";
import type { DatosDashboard, VentasDashboard } from "@/lib/panel/dashboard";
import { etiquetaEstadoPedido, tonoEstadoPedido } from "@/lib/pedidos/reglas";

const claseEnlace =
  "ui-boton ui-boton-secundario inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold";

export function DashboardPanel({
  datos,
  sucursal,
  slug,
}: {
  datos: DatosDashboard;
  sucursal: string | null;
  slug: string;
}) {
  const { ventas } = datos;

  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-pretty text-lg font-semibold">Resumen{sucursal ? ` · ${sucursal}` : ""}</h2>
        <Tag tono="brand">Hoy</Tag>
      </div>

      {ventas ? <Indicadores ventas={ventas} /> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {ventas ? <Semana semana={ventas.semana} /> : null}

        <section className="dashboard-tarjeta">
          <h3>Requiere atención</h3>
          <ul className="flex flex-col gap-3.5">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Tag tono={datos.nuevos ? "brand" : "ok"}>{datos.nuevos}</Tag>
                {datos.nuevos === 1 ? "pedido nuevo" : "pedidos nuevos"}
              </span>
              <Link href={`/t/${slug}/pedidos?estado=pendiente`} className={claseEnlace}>
                Ver pedidos
              </Link>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Tag tono={datos.stockBajo ? "danger" : "ok"}>{datos.stockBajo}</Tag>
                {datos.stockBajo === 1 ? "producto con stock bajo" : "productos con stock bajo"}
              </span>
              <Link href={`/t/${slug}/productos`} className={claseEnlace}>
                Ver productos
              </Link>
            </li>
            {datos.licencia ? (
              <li className="flex items-center justify-between gap-3">
                <span>Licencia {datos.licencia.plan}</span>
                {datos.licencia.dias == null ? (
                  <Tag tono="ok">Sin vencimiento</Tag>
                ) : datos.licencia.dias < 0 ? (
                  <Tag tono="danger">Vencida</Tag>
                ) : (
                  <Tag tono={datos.licencia.dias <= 7 ? "warn" : "ok"}>
                    {datos.licencia.dias === 0
                      ? "Vence hoy"
                      : `Vence en ${datos.licencia.dias} ${datos.licencia.dias === 1 ? "día" : "días"}`}
                  </Tag>
                )}
              </li>
            ) : null}
          </ul>
        </section>

        {ventas ? (
          <section className="dashboard-tarjeta">
            <h3>Más vendidos (mes)</h3>
            {ventas.masVendidos.length === 0 ? (
              <SinDatos />
            ) : (
              <ListaBarras
                filas={ventas.masVendidos.map((fila) => ({ nombre: fila.nombre, valor: fila.unidades, texto: `${fila.unidades} uds` }))}
              />
            )}
          </section>
        ) : null}

        {ventas && ventas.porSucursal.length > 1 ? (
          <section className="dashboard-tarjeta">
            <h3>Ventas por sucursal (mes)</h3>
            <ListaBarras
              filas={ventas.porSucursal.map((fila) => ({ nombre: fila.nombre, valor: fila.ventas, texto: formatoBs(fila.ventas) }))}
            />
          </section>
        ) : null}

        <section className="dashboard-tarjeta">
          <h3>Últimos pedidos</h3>
          {datos.ultimos.length === 0 ? (
            <p className="text-sm text-[var(--mu)]">Todavía no hay pedidos.</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {datos.ultimos.map((pedido) => (
                <li key={pedido.id} className="flex items-center justify-between gap-3">
                  <span>
                    <b className="tabular-nums">#{pedido.id}</b> · {pedido.cliente}
                    <br />
                    <span className="text-sm text-[var(--mu)]">
                      {pedido.tipo === "delivery" ? "Delivery" : "Recojo"} · {formatoBs(pedido.total)}
                    </span>
                  </span>
                  <Tag tono={tonoEstadoPedido(pedido.estado)}>{etiquetaEstadoPedido(pedido.estado, pedido.origen)}</Tag>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Indicadores({ ventas }: { ventas: VentasDashboard }) {
  return (
    <div className="dashboard-kpis">
      <div>
        <strong className="tabular-nums">{bsRedondo(ventas.ventasHoy)}</strong>
        <p>
          Ventas{" "}
          {ventas.variacion != null ? (
            <span
              className={ventas.variacion >= 0 ? "text-[var(--ok)]" : "text-[var(--er)]"}
              title="Frente a ayer a esta misma hora"
            >
              {ventas.variacion >= 0 ? "+" : ""}
              {ventas.variacion}%
            </span>
          ) : null}
        </p>
      </div>
      <div>
        <strong className="tabular-nums">{ventas.pedidosHoy}</strong>
        <p>Pedidos</p>
      </div>
      <div>
        <strong className="tabular-nums">{bsRedondo(ventas.ticket)}</strong>
        <p>Ticket promedio</p>
      </div>
    </div>
  );
}

function Semana({ semana }: { semana: VentasDashboard["semana"] }) {
  const maximo = Math.max(1, ...semana.map((dia) => dia.ventas));
  const ultimo = semana.length - 1;
  return (
    <section className="dashboard-tarjeta lg:col-span-2">
      <h3>Ventas de la semana</h3>
      <ol className="flex h-[150px] items-end gap-2" aria-label="Ventas de los últimos 7 días">
        {semana.map((dia, indice) => {
          const hoy = indice === ultimo;
          return (
            <li
              key={indice}
              className={`flex h-full flex-1 flex-col justify-end gap-1.5 text-center text-xs ${hoy ? "font-semibold text-[var(--tx)]" : "text-[var(--mu)]"}`}
              title={formatoBs(dia.ventas)}
            >
              <span
                aria-hidden="true"
                className="block rounded-t-lg rounded-b-sm"
                style={{
                  height: `${Math.max(4, Math.round((dia.ventas / maximo) * 100))}px`,
                  background: hoy ? "var(--gr)" : "var(--sf2)",
                }}
              />
              <span>
                {dia.dia}
                <span className="sr-only">: {formatoBs(dia.ventas)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ListaBarras({ filas }: { filas: { nombre: string; valor: number; texto: string }[] }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.valor));
  return (
    <ul className="flex flex-col gap-3.5">
      {filas.map((fila) => (
        <li key={fila.nombre}>
          <div className="flex items-center justify-between gap-3">
            <span>{fila.nombre}</span>
            <b className="tabular-nums">{fila.texto}</b>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--sf2)]">
            <i className="block h-full rounded-full" style={{ width: `${(fila.valor / maximo) * 100}%`, background: "var(--gr)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SinDatos() {
  return <p className="text-sm text-[var(--mu)]">Todavía no hay ventas este mes.</p>;
}

const bsEntero = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });

function bsRedondo(valor: number) {
  return `Bs ${bsEntero.format(valor)}`;
}
