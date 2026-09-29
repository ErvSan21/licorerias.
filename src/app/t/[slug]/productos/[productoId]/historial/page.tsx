import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { BotonVolver } from "@/components/ui/boton-volver";
import { EmptyState } from "@/components/ui/empty-state";
import { NoEncontrado } from "@/lib/auth/errors";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import { listarHistorial } from "@/lib/catalogo/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function HistorialProductoPage({
  params,
}: {
  params: Promise<{ slug: string; productoId: string }>;
}) {
  const { slug, productoId } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos/${productoId}/historial`)}`);
  }

  let producto;
  let historial;
  try {
    const leido = await listarHistorial(normalizado, productoId);
    producto = leido.producto;
    historial = leido.historial;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado) notFound();
    throw error;
  }

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${normalizado}/productos`} etiqueta="Productos" />
      <h2 className="break-words text-lg font-semibold">Historial de {producto.nombre}</h2>
      {historial.length === 0 ? (
        <EmptyState titulo="Sin cambios de precio" descripcion="Cuando cambie el central o un precio propio, aparece aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {historial.map((item) => (
            <li key={item.id} className="rounded-xl border border-[var(--ln)] p-4 text-sm">
              <p className="font-medium">
                {item.tipo === "central" && item.sucursalId ? "Volvió al central" : item.tipo === "central" ? "Precio central" : "Precio propio"}
                {item.sucursalNombre ? ` · ${item.sucursalNombre}` : ""}
              </p>
              <p className="tabular-nums">
                {item.precioAnterior == null ? "Sin anterior" : formatoBs(item.precioAnterior)} → {formatoBs(item.precioNuevo)}
              </p>
              <p className="text-[var(--mu)]">
                <time dateTime={item.creadoEn}>{formatoFechaPrecio(item.creadoEn)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
