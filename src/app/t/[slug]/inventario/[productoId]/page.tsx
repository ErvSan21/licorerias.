import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { usuarioVerificado } from "@/lib/auth/staff";
import { etiquetaMovimiento, formatoFechaInventario } from "@/lib/inventario/reglas";
import { leerMovimientos } from "@/lib/inventario/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function MovimientosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productoId: string }>;
  searchParams: Promise<{ sucursal?: string }>;
}) {
  const { slug, productoId } = await params;
  const { sucursal } = await searchParams;
  const normalizado = normalizarSlug(slug);
  const destino = `/t/${normalizado}/inventario/${productoId}${sucursal ? `?sucursal=${sucursal}` : ""}`;
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(destino)}`);
  }
  const resultado = await leerMovimientos(normalizado, productoId, sucursal ?? null);

  return (
    <main className="flex flex-col gap-4">
      <Link
        href={`/t/${normalizado}/inventario`}
        className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline underline-offset-4"
      >
        Volver al inventario
      </Link>
      <h2 className="text-pretty break-words text-lg font-semibold">Movimientos de {resultado.producto.nombre}</h2>
      {resultado.movimientos.length === 0 ? (
        <EmptyState titulo="Todavía no hay movimientos" descripcion="Las reposiciones, ajustes y transferencias aparecen aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {resultado.movimientos.map((movimiento) => (
            <li
              key={movimiento.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 96px" }}
            >
              <p className="font-medium">{etiquetaMovimiento(movimiento.tipo)}</p>
              <p className="text-sm tabular-nums">
                {movimiento.cantidad > 0 ? `+${movimiento.cantidad}` : movimiento.cantidad} · {movimiento.sucursal}
              </p>
              {movimiento.motivo ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{movimiento.motivo}</p> : null}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <time dateTime={movimiento.creadoEn}>{formatoFechaInventario(movimiento.creadoEn)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
