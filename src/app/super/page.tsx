import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import {
  etiquetaLicencia,
  formatoBs,
  formatoFecha,
  hoyBolivia,
  vencePronto,
} from "@/lib/licencias/reglas";
import { listarTiendas, type TiendaLicencia } from "@/lib/licencias/servicio";
import { etiquetaEstado } from "@/lib/tenant";

export default async function SuperPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const porVencer = vista === "por-vencer";
  const hoy = hoyBolivia();
  const tiendas = await listarTiendas();
  const visibles = porVencer ? tiendas.filter((tienda) => esPorVencer(tienda, hoy)) : tiendas;
  const cuantas = tiendas.filter((tienda) => esPorVencer(tienda, hoy)).length;

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tiendas</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {cuantas === 1 ? "1 tienda vence en 7 días." : `${cuantas} tiendas vencen en 7 días.`}
          </p>
        </div>
        <nav aria-label="Vistas de tiendas" className="flex gap-2">
          <Link
            href="/super"
            aria-current={porVencer ? undefined : "page"}
            className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium underline-offset-4 aria-[current=page]:border-zinc-900 aria-[current=page]:font-semibold aria-[current=page]:underline dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100"
          >
            Todas
          </Link>
          <Link
            href="/super?vista=por-vencer"
            aria-current={porVencer ? "page" : undefined}
            className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium underline-offset-4 aria-[current=page]:border-zinc-900 aria-[current=page]:font-semibold aria-[current=page]:underline dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100"
          >
            Por vencer
          </Link>
        </nav>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          titulo={porVencer ? "Ninguna tienda vence pronto" : "Todavía no hay tiendas"}
          descripcion={
            porVencer
              ? "En los próximos 7 días no vence ninguna licencia activa."
              : "Crea la primera tienda con una licencia de prueba."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">Tiendas, plan y vencimiento</caption>
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="px-2 py-3 font-medium">
                  Tienda
                </th>
                <th scope="col" className="px-2 py-3 font-medium">
                  Plan
                </th>
                <th scope="col" className="px-2 py-3 font-medium">
                  Licencia
                </th>
                <th scope="col" className="px-2 py-3 font-medium">
                  Vence
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((tienda) => (
                <Fila key={tienda.id} tienda={tienda} hoy={hoy} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Fila({ tienda, hoy }: { tienda: TiendaLicencia; hoy: string }) {
  const pronto =
    tienda.licencia &&
    (tienda.licencia.estado === "prueba" || tienda.licencia.estado === "activa") &&
    vencePronto(tienda.licencia.vence, hoy);

  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-800">
      <th scope="row" className="px-2 py-3 font-medium">
        <Link
          href={`/super/tiendas/${tienda.id}`}
          className="inline-flex min-h-11 touch-manipulation items-center break-words underline-offset-4 hover:underline"
        >
          {tienda.nombre}
        </Link>
        <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">
          {etiquetaEstado(tienda.estado)}
        </span>
      </th>
      <td className="px-2 py-3 tabular-nums">
        {tienda.licencia
          ? `${tienda.licencia.plan.nombre} · ${formatoBs(tienda.licencia.plan.precioMensual)}`
          : "Sin plan"}
      </td>
      <td className="px-2 py-3">
        {tienda.licencia ? etiquetaLicencia(tienda.licencia.estado) : "Sin licencia"}
      </td>
      <td className="px-2 py-3 tabular-nums">
        {tienda.licencia?.vence ? (
          <>
            <time dateTime={tienda.licencia.vence}>{formatoFecha(tienda.licencia.vence)}</time>
            {pronto ? (
              <span className="mt-1 block text-xs font-medium text-amber-800 dark:text-amber-200">
                Vence pronto
              </span>
            ) : null}
          </>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function esPorVencer(tienda: TiendaLicencia, hoy: string): boolean {
  if (tienda.estado !== "activa" || !tienda.licencia) return false;
  if (tienda.licencia.estado !== "prueba" && tienda.licencia.estado !== "activa") return false;
  return vencePronto(tienda.licencia.vence, hoy);
}
