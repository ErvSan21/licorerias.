import Link from "next/link";
import { redirect } from "next/navigation";

import { InterruptorCatalogoCentral, InterruptorPreciosCentral } from "@/components/panel/ajustes-sucursales";
import { InterruptorAbierta } from "@/components/panel/interruptor-abierta";
import { BotonVolver } from "@/components/ui/boton-volver";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerAjustesSucursales } from "@/lib/sucursales/ajustes";
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
  const [contexto, ajustes] = await Promise.all([contextoPanel(normalizado), leerAjustesSucursales(normalizado)]);
  const visibles = contexto.seleccion
    ? contexto.sucursales.filter((sucursal) => sucursal.id === contexto.seleccion)
    : contexto.sucursales;
  const ordenadas = visibles.toSorted((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  const idCentral = contexto.sucursales
    .filter((sucursal) => sucursal.activa)
    .toSorted((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))[0]?.id;
  const dueno = contexto.staff.rol === "dueno";
  const lectura = !dueno || !contexto.vigente;
  const slugTienda = contexto.tienda.slug;

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${slugTienda}/configuracion`} etiqueta="Configuración" />
      <h2 className="text-pretty text-lg font-semibold">Sucursales</h2>

      <section className="dashboard-tarjeta" aria-labelledby="ajustes-sucursales">
        <h3 id="ajustes-sucursales" className="!mb-1">
          Ajustes de las sucursales
        </h3>
        {!dueno ? <p className="text-sm text-[var(--mu)]">Solo el dueño cambia estos ajustes.</p> : null}
        <InterruptorPreciosCentral
          slug={slugTienda}
          lectura={lectura}
          permiten={ajustes.permitenPrecioPropio}
          margen={ajustes.margenMax}
        />
        <InterruptorCatalogoCentral slug={slugTienda} lectura={lectura} activo={ajustes.catalogoCentral} />
      </section>

      <section className="dashboard-tarjeta" aria-labelledby="lista-sucursales">
        {/* Las sucursales nuevas las crea el super admin desde Administración. */}
        <h3 id="lista-sucursales">{ordenadas.length === 1 ? "Sucursal" : "Sucursales"}</h3>
        {ordenadas.length === 0 ? (
          <EmptyState titulo="Todavía no hay sucursales" descripcion="Nadie te asignó una sucursal." />
        ) : (
          <ul className="stock-lista">
            {ordenadas.map((sucursal) => (
              <li key={sucursal.id} className="stock-fila flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {dueno ? (
                      <Link href={`/t/${slugTienda}/sucursales/${sucursal.id}`} className="break-words font-semibold">
                        {sucursal.nombre}
                      </Link>
                    ) : (
                      <p className="break-words font-semibold">{sucursal.nombre}</p>
                    )}
                    {sucursal.id === idCentral ? <Tag tono="brand">Central</Tag> : null}
                    {sucursal.activa ? null : <Tag>Inactiva</Tag>}
                  </div>
                  <p className="text-sm text-[var(--mu)]">{sucursal.direccion || "Sin dirección"}</p>
                  {sucursal.telefono ? (
                    <p className="text-sm tabular-nums text-[var(--mu)]">{formatoTelefono(sucursal.telefono)}</p>
                  ) : null}
                </div>
                {dueno ? (
                  <InterruptorAbierta
                    slug={slugTienda}
                    sucursalId={sucursal.id}
                    abierta={sucursal.abierta}
                    lectura={!contexto.vigente || !sucursal.activa}
                  />
                ) : (
                  <Tag tono={sucursal.abierta ? "ok" : "neutro"}>{sucursal.abierta ? "Abierta" : "Cerrada"}</Tag>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
