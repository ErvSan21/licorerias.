import { FormularioPrecios } from "@/components/administracion/precios-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { leerTablero } from "@/lib/administracion/servicio";
import { formatoBs, formatoFecha } from "@/lib/licencias/reglas";

export default async function DashboardPage() {
  const tablero = await leerTablero();

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--mu)]">
          {tablero.registradas === 1 ? "1 licorería registrada." : `${tablero.registradas} licorerías registradas.`}
        </p>
      </div>

      <section className="panel-kpis" aria-label="Resumen">
        <article className="panel-kpi">
          <p>Licorerías</p>
          <strong className="tabular-nums">{tablero.registradas}</strong>
        </article>
        <article className="panel-kpi">
          <p>Por vencer</p>
          <strong className="tabular-nums">{tablero.porVencer.length}</strong>
        </article>
        <article className="panel-kpi">
          <p>Pedidos, 30 días</p>
          <strong className="tabular-nums">{tablero.totales.pedidos}</strong>
        </article>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-vencer">
        <h2 id="titulo-vencer" className="text-lg font-semibold">
          Suscripción próxima a vencer
        </h2>
        {tablero.porVencer.length === 0 ? (
          <EmptyState titulo="Ninguna vence en 7 días" descripcion="No hay licencias activas por vencer." />
        ) : (
          <ul className="flex flex-col gap-2">
            {tablero.porVencer.map((tienda) => (
              <li key={tienda.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <span className="font-medium">{tienda.nombre}</span>
                  <time dateTime={tienda.vence} className="tabular-nums text-sm">
                    {formatoFecha(tienda.vence)}
                  </time>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-metricas">
        <div>
          <h2 id="titulo-metricas" className="text-lg font-semibold">
            Tiendas, últimos 30 días
          </h2>
          <p className="mt-1 text-sm text-[var(--mu)]">
            Del {formatoFecha(tablero.desde)} al {formatoFecha(tablero.hasta)}. Ventas y pedidos salen del reporte de cada tienda. Si no hay pedidos, el monto es 0.
          </p>
        </div>
        {tablero.metricas.length === 0 ? (
          <EmptyState titulo="Todavía no hay tiendas" />
        ) : (
          <ul className="flex flex-col gap-3">
            {tablero.metricas.map((tienda) => (
              <li key={tienda.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <h3 className="font-semibold">{tienda.nombre}</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
                    <Dato termino="Pedidos" valor={String(tienda.pedidos)} />
                    <Dato termino="Ventas" valor={formatoBs(tienda.ventas)} />
                    <Dato termino="Ticket" valor={formatoBs(tienda.ticket)} />
                    <Dato termino="Cancelados" valor={String(tienda.cancelados)} />
                    <Dato termino="Inventario" valor={formatoBs(tienda.inventario)} />
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-ingresos">
        <h2 id="titulo-ingresos" className="text-lg font-semibold">
          Dinero de suscripciones
        </h2>
        <div className="panel-kpis">
          <article className="panel-kpi">
            <p>1 mes</p>
            <strong className="tabular-nums">{formatoBs(tablero.ingresos.mes)}</strong>
          </article>
          <article className="panel-kpi">
            <p>3 meses</p>
            <strong className="tabular-nums">{formatoBs(tablero.ingresos.tres_meses)}</strong>
          </article>
          <article className="panel-kpi">
            <p>1 año</p>
            <strong className="tabular-nums">{formatoBs(tablero.ingresos.anio)}</strong>
          </article>
        </div>
        <FormularioPrecios precios={tablero.precios} />
      </section>
    </main>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-[var(--mu)]">{termino}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
