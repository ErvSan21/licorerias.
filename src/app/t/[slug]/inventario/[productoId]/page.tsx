import Link from "next/link";
import { redirect } from "next/navigation";

import { BotonVolver } from "@/components/ui/boton-volver";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { usuarioVerificado } from "@/lib/auth/staff";
import { etiquetaMovimiento, formatoFechaInventario } from "@/lib/inventario/reglas";
import { leerMovimientos } from "@/lib/inventario/servicio";
import { normalizarSlug } from "@/lib/tenant";

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "venta", etiqueta: "Ventas" },
  { valor: "entrada", etiqueta: "Stock agregado" },
] as const;

export default async function MovimientosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productoId: string }>;
  searchParams: Promise<{ sucursal?: string; tipo?: string }>;
}) {
  const { slug, productoId } = await params;
  const { sucursal, tipo } = await searchParams;
  const normalizado = normalizarSlug(slug);
  const base = `/t/${normalizado}/inventario/${productoId}`;
  const destino = `${base}${sucursal ? `?sucursal=${sucursal}` : ""}`;
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(destino)}`);
  }
  const resultado = await leerMovimientos(normalizado, productoId, sucursal ?? null);
  const filtro = tipo === "venta" || tipo === "entrada" ? tipo : "";
  const movimientos = filtro ? resultado.movimientos.filter((movimiento) => movimiento.tipo === filtro) : resultado.movimientos;
  const stock = resultado.filas.reduce((suma, fila) => suma + fila.stock, 0);
  const variasSucursales = new Set(resultado.filas.map((fila) => fila.sucursalId)).size > 1;

  function enlace(valor: string) {
    const consulta = new URLSearchParams();
    if (sucursal) consulta.set("sucursal", sucursal);
    if (valor) consulta.set("tipo", valor);
    const texto = consulta.toString();
    return texto ? `${base}?${texto}` : base;
  }

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${normalizado}/productos`} etiqueta="Productos" />
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-pretty break-words text-lg font-semibold">Movimientos · {resultado.producto.nombre}</h2>
        <Tag tono={stock <= 0 ? "danger" : "neutro"}>Stock {stock}</Tag>
      </div>

      <nav aria-label="Tipo de movimiento" className="chips-carrusel">
        {FILTROS.map((opcion) => {
          const activo = filtro === opcion.valor;
          return (
            <Link
              key={opcion.valor || "todos"}
              href={enlace(opcion.valor)}
              aria-current={activo ? "page" : undefined}
              className={`ui-chip inline-flex shrink-0 items-center text-sm ${activo ? "ui-chip-activo" : ""}`}
            >
              {opcion.etiqueta}
            </Link>
          );
        })}
      </nav>

      {movimientos.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay movimientos"
          descripcion={
            filtro === "venta"
              ? "Cuando se venda este producto, aparece aquí."
              : filtro === "entrada"
                ? "Cuando agregues stock, aparece aquí."
                : "Las ventas y el stock agregado aparecen aquí."
          }
        />
      ) : (
        <ul className="stock-lista">
          {movimientos.map((movimiento) => {
            const suma = movimiento.cantidad > 0;
            return (
              <li key={movimiento.id} className="stock-fila">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{etiquetaMovimiento(movimiento.tipo)}</p>
                  <p className="text-xs text-[var(--mu)]">
                    <time dateTime={movimiento.creadoEn}>{formatoFechaInventario(movimiento.creadoEn)}</time>
                    {variasSucursales ? ` · ${movimiento.sucursal}` : ""}
                    {movimiento.motivo && movimiento.tipo !== "venta" ? ` · ${movimiento.motivo}` : ""}
                  </p>
                </div>
                <b className={`shrink-0 tabular-nums ${suma ? "text-[var(--ok)]" : "text-[var(--er)]"}`}>
                  {suma ? "+" : "−"}
                  {Math.abs(movimiento.cantidad)}
                </b>
              </li>
            );
          })}
        </ul>
      )}
      {resultado.movimientos.length >= 100 ? (
        <p className="text-xs text-[var(--mu)]">Se muestran los últimos 100 movimientos.</p>
      ) : null}
    </main>
  );
}
