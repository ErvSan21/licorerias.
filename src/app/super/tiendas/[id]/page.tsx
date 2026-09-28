import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FormularioAsignar,
  FormularioExtender,
  FormularioPago,
  FormularioPlan,
  ReactivarLicencia,
  SuspenderLicencia,
} from "@/components/super/acciones-licencia";
import { NegocioError, etiquetaLicencia, formatoBs, formatoFecha, textoTope } from "@/lib/licencias/reglas";
import { leerTiendaSuper, listarPlanes } from "@/lib/licencias/servicio";
import { esRolTienda, etiquetaEstado, etiquetaRol } from "@/lib/tenant";

export default async function TiendaSuperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planes = listarPlanes();
  let detalle: Awaited<ReturnType<typeof leerTiendaSuper>>;
  try {
    detalle = await leerTiendaSuper(id);
  } catch (error) {
    if (error instanceof NegocioError) notFound();
    throw error;
  }
  const catalogo = await planes;
  const { tienda, miembros, pagos, auditoria } = detalle;
  const opciones = catalogo.map((plan) => ({
    id: plan.id,
    nombre: plan.nombre,
    precioMensual: plan.precioMensual,
  }));

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href="/super"
          className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          Volver a tiendas
        </Link>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">{tienda.nombre}</h1>
        <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">
          <span translate="no">{tienda.slug}</span> · {etiquetaEstado(tienda.estado)}
        </p>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="titulo-licencia">
        <h2 id="titulo-licencia" className="text-lg font-semibold">
          Licencia
        </h2>
        {tienda.licencia ? (
          <dl className="grid gap-3 text-sm tabular-nums sm:grid-cols-2">
            <Dato termino="Estado" valor={etiquetaLicencia(tienda.licencia.estado)} />
            <Dato
              termino="Plan"
              valor={`${tienda.licencia.plan.nombre} · ${formatoBs(tienda.licencia.plan.precioMensual)} / mes`}
            />
            <Dato termino="Inicio" valor={formatoFecha(tienda.licencia.inicio)} />
            <Dato termino="Vence" valor={formatoFecha(tienda.licencia.vence)} />
            <Dato termino="Días de gracia" valor={String(tienda.licencia.diasGracia)} />
            <Dato
              termino="Sucursales"
              valor={textoTope(tienda.licencia.plan.maxSucursales, "Ilimitadas")}
            />
            <Dato
              termino="Productos"
              valor={textoTope(tienda.licencia.plan.maxProductos, "Ilimitados")}
            />
            <Dato
              termino="Usuarios"
              valor={textoTope(tienda.licencia.plan.maxUsuarios, "Ilimitados")}
            />
          </dl>
        ) : (
          <p className="text-sm leading-6">Esta tienda todavía no tiene licencia.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {tienda.licencia ? (
          <>
            <FormularioPlan tiendaId={tienda.id} planId={tienda.licencia.plan.id} planes={opciones} />
            <FormularioExtender tiendaId={tienda.id} vence={tienda.licencia.vence} />
            <FormularioPago tiendaId={tienda.id} />
            <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-base font-semibold">Estado de la licencia</h3>
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Suspender corta la tienda pública y deja el panel en solo lectura. Reactivar exige
                que la fecha, con los días de gracia, siga vigente.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SuspenderLicencia tiendaId={tienda.id} />
                <ReactivarLicencia tiendaId={tienda.id} />
              </div>
            </section>
          </>
        ) : (
          <FormularioAsignar tiendaId={tienda.id} planes={opciones} />
        )}
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="titulo-personal">
        <h2 id="titulo-personal" className="text-lg font-semibold">
          Personal
        </h2>
        {miembros.length === 0 ? (
          <p className="text-sm">Nadie está asignado a esta tienda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {miembros.map((miembro) => (
              <li key={miembro.id} className="flex min-h-11 flex-col justify-center text-sm">
                <span>{miembro.correo ?? "Sin correo"}</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {esRolTienda(miembro.rol) ? etiquetaRol(miembro.rol) : miembro.rol}
                  {miembro.activo ? "" : " · Inactivo"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="titulo-pagos">
        <h2 id="titulo-pagos" className="text-lg font-semibold">
          Pagos
        </h2>
        {pagos.length === 0 ? (
          <p className="text-sm">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pagos.map((pago) => (
              <li key={pago.id} className="text-sm leading-6 tabular-nums">
                <span className="font-medium">{formatoBs(pago.monto)}</span>
                {" · "}
                {pago.metodo === "qr" ? "QR" : "Transferencia"}
                {" · "}
                <time dateTime={pago.fecha}>{formatoFecha(pago.fecha)}</time>
                <span className="block text-zinc-600 dark:text-zinc-400">
                  Periodo {formatoFecha(pago.periodoDesde)} a {formatoFecha(pago.periodoHasta)}
                  {pago.referencia ? ` · Ref. ${pago.referencia}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="titulo-auditoria">
        <h2 id="titulo-auditoria" className="text-lg font-semibold">
          Actividad reciente
        </h2>
        <ul className="flex flex-col gap-2">
          {auditoria.map((fila) => (
            <li key={fila.id} className="text-sm">
              {etiquetaAccion(fila.accion)}
              {" · "}
              <time dateTime={fila.creadoEn}>{formatoInstante(fila.creadoEn)}</time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-zinc-600 dark:text-zinc-400">{termino}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function etiquetaAccion(accion: string): string {
  const etiquetas: Record<string, string> = {
    "tienda.lectura": "Lectura del super admin",
    "tienda.alta": "Alta de tienda",
    "licencia.asignar": "Licencia asignada",
    "licencia.plan": "Cambio de plan",
    "licencia.extender": "Vencimiento extendido",
    "licencia.suspender": "Licencia suspendida",
    "licencia.reactivar": "Licencia reactivada",
    "licencia.pago": "Pago registrado",
    login: "Entrada",
    logout: "Salida",
  };
  return etiquetas[accion] ?? "Registro";
}

function formatoInstante(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(fecha);
}
