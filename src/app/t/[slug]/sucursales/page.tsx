import Link from "next/link";
import { redirect } from "next/navigation";

import { InterruptorAbierta } from "@/components/panel/interruptor-abierta";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoTelefono } from "@/lib/sucursales/reglas";
import { normalizarSlug } from "@/lib/tenant";

export default async function SucursalesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/sucursales`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  const visibles = contexto.seleccion
    ? contexto.sucursales.filter((sucursal) => sucursal.id === contexto.seleccion)
    : contexto.sucursales;
  const dueno = contexto.staff.rol === "dueno";

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Sucursales</h2>
        {dueno ? (
          <Link
            href={`/t/${contexto.tienda.slug}/sucursales/nueva`}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            Nueva sucursal
          </Link>
        ) : null}
      </div>
      {visibles.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay sucursales"
          descripcion={dueno ? "Crea la primera sucursal de la tienda." : "Nadie te asignó una sucursal."}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((sucursal) => (
            <li
              key={sucursal.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                {dueno ? (
                  <Link
                    href={`/t/${contexto.tienda.slug}/sucursales/${sucursal.id}`}
                    className="inline-flex min-h-11 touch-manipulation items-center break-words text-base font-semibold underline-offset-4 hover:underline"
                  >
                    {sucursal.nombre}
                  </Link>
                ) : (
                  <p className="break-words text-base font-semibold">{sucursal.nombre}</p>
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400" translate="no">
                  {sucursal.slug}
                </p>
                <p className="text-sm leading-6">{sucursal.direccion || "Sin dirección"}</p>
                <p className="text-sm tabular-nums">{formatoTelefono(sucursal.telefono)}</p>
                <p className="text-sm">{sucursal.activa ? "Activa" : "Inactiva"}</p>
              </div>
              {dueno ? (
                <InterruptorAbierta
                  slug={contexto.tienda.slug}
                  sucursalId={sucursal.id}
                  abierta={sucursal.abierta}
                  lectura={!contexto.vigente || !sucursal.activa}
                />
              ) : (
                <p className="text-sm">{sucursal.abierta ? "Abierta" : "Cerrada"}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
