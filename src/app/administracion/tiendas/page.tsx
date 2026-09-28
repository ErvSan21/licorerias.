import { InactivarTienda } from "@/components/administracion/inactivar-tienda";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fechaAlta } from "@/lib/administracion/reglas";
import { formatoFecha } from "@/lib/licencias/reglas";
import { listarTiendas } from "@/lib/licencias/servicio";
import { etiquetaEstado } from "@/lib/tenant";

export default async function TiendasPage() {
  const tiendas = await listarTiendas();

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Tiendas</h2>
      {tiendas.length === 0 ? (
        <EmptyState titulo="Todavía no hay tiendas" descripcion="Cuando se registre una licorería, aparece aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {tiendas.map((tienda) => {
            const fin = tienda.licencia?.vence ?? null;
            const puedeInactivar = tienda.estado === "activa" && Boolean(tienda.licencia);
            return (
              <li key={tienda.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{tienda.nombre}</h3>
                    <span className="text-sm text-[var(--mu)]">{etiquetaEstado(tienda.estado)}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[var(--mu)]">Alta</dt>
                      <dd className="tabular-nums">
                        <time dateTime={fechaAlta(tienda.creadoEn)}>{formatoFecha(fechaAlta(tienda.creadoEn))}</time>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--mu)]">Fin</dt>
                      <dd className="tabular-nums">{fin ? <time dateTime={fin}>{formatoFecha(fin)}</time> : "Sin fecha"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[var(--mu)]">Plan</dt>
                      <dd>{tienda.licencia?.plan.nombre ?? "Sin plan"}</dd>
                    </div>
                  </dl>
                  {puedeInactivar ? <InactivarTienda tiendaId={tienda.id} nombre={tienda.nombre} /> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
