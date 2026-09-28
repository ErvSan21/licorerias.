import { notFound, redirect } from "next/navigation";

import { ExportarReporte } from "@/components/panel/exportar-reporte";
import { GraficosDiferidos } from "@/components/panel/graficos-diferidos";
import { Campo, claseCampo } from "@/components/super/campo";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoBs } from "@/lib/catalogo/reglas";
import { NegocioError } from "@/lib/licencias/reglas";
import { leerReporte } from "@/lib/reportes/servicio";
import { sinMovimiento } from "@/lib/reportes/reglas";
import { normalizarSlug } from "@/lib/tenant";

export default async function ReportesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; sucursal?: string }>;
}) {
  const { slug } = await params;
  const consulta = await searchParams;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/reportes`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol === "vendedor") notFound();

  let datos;
  try {
    datos = await leerReporte(normalizado, contexto.sucursales.map((sucursal) => sucursal.id), consulta);
  } catch (error) {
    const mensaje = error instanceof NegocioError ? error.message : "No se pudo cargar el reporte.";
    return <p className="text-sm text-red-800 dark:text-red-300">{mensaje}</p>;
  }

  const { reporte, desde, hasta, sucursal } = datos;
  const csv = `/api/t/${contexto.tienda.slug}/reportes?desde=${desde}&hasta=${hasta}${sucursal ? `&sucursal=${sucursal}` : ""}`;

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="scroll-mt-24 text-pretty text-lg font-semibold">Reportes</h2>
        <ExportarReporte href={csv} />
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Campo id="reporte-desde" etiqueta="Desde">
          <input id="reporte-desde" name="desde" type="date" autoComplete="off" required defaultValue={desde} className={claseCampo} />
        </Campo>
        <Campo id="reporte-hasta" etiqueta="Hasta">
          <input id="reporte-hasta" name="hasta" type="date" autoComplete="off" required defaultValue={hasta} className={claseCampo} />
        </Campo>
        <Campo id="reporte-sucursal" etiqueta="Sucursal">
          <select id="reporte-sucursal" name="sucursal" defaultValue={sucursal} className={claseCampo}>
            <option value="">{contexto.staff.rol === "dueno" ? "Toda la tienda" : "Mis sucursales"}</option>
            {contexto.sucursales.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <button type="submit" className="ui-boton inline-flex min-h-12 touch-manipulation items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
          Ver
        </button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta etiqueta="Ventas" valor={formatoBs(reporte.ventas)} />
        <Tarjeta etiqueta="Pedidos" valor={String(reporte.pedidos)} />
        <Tarjeta etiqueta="Ticket promedio" valor={formatoBs(reporte.ticket)} />
      </div>
      <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        Cancelados: {reporte.cancelados} · {formatoBs(reporte.montoCancelado)}
      </p>
      {sinMovimiento(reporte) ? (
        <EmptyState titulo="No hay pedidos en este rango" descripcion="Prueba otras fechas o otra sucursal." />
      ) : (
        <GraficosDiferidos reporte={reporte} />
      )}
    </main>
  );
}

function Tarjeta({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-sm text-zinc-600 dark:text-zinc-400">{etiqueta}</h3>
      <p className="text-pretty text-xl font-semibold tabular-nums">{valor}</p>
    </section>
  );
}
