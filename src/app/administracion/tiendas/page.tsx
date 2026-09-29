import { MenuTienda } from "@/components/administracion/menu-tienda";
import { NuevaTienda } from "@/components/administracion/nueva-tienda";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { conteoSucursales, tiendasConSucursales } from "@/lib/administracion/servicio";
import { fechaAlta } from "@/lib/administracion/reglas";
import { esPlazo, etiquetaPlazo, formatoFecha } from "@/lib/licencias/reglas";
import { listarTiendas } from "@/lib/licencias/servicio";
import { etiquetaEstado } from "@/lib/tenant";

export default async function TiendasPage() {
  const [tiendas, sucursales, conSucursales] = await Promise.all([
    listarTiendas(),
    conteoSucursales(),
    tiendasConSucursales(),
  ]);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tiendas</h2>
        <NuevaTienda />
      </div>
      {tiendas.length === 0 ? (
        <EmptyState titulo="Todavía no hay tiendas" descripcion="Crea una con el botón +." />
      ) : (
        <ul className="flex flex-col gap-3">
          {tiendas.map((tienda) => {
            const fin = tienda.licencia?.vence ?? null;
            const plazo = tienda.licencia && esPlazo(tienda.licencia.plazo) ? tienda.licencia.plazo : null;
            return (
              <li key={tienda.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{tienda.nombre}</h3>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-[var(--mu)]">{etiquetaEstado(tienda.estado)}</span>
                      <MenuTienda
                        tienda={{
                          id: tienda.id,
                          nombre: tienda.nombre,
                          estado: tienda.estado,
                          inicio: tienda.licencia?.inicio ?? null,
                          vence: fin,
                          plazo,
                          sucursalesHabilitadas: conSucursales.has(tienda.id),
                        }}
                      />
                    </div>
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
                      <dd className="tabular-nums">{fin ? <time dateTime={fin}>{formatoFecha(fin)}</time> : null}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--mu)]">Sucursales</dt>
                      <dd className="tabular-nums">{sucursales[tienda.id] ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--mu)]">Plan</dt>
                      <dd>{plazo ? etiquetaPlazo(plazo) : "Sin plan"}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
