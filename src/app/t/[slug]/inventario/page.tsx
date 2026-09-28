import { redirect } from "next/navigation";

import { InventarioPanel } from "@/components/panel/inventario-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { agruparPorCategoria, resumenStockBajo } from "@/lib/inventario/reglas";
import { listarInventario } from "@/lib/inventario/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function InventarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/inventario`)}`);
  }
  const [contexto, inventario] = await Promise.all([
    contextoPanel(normalizado),
    listarInventario(normalizado, null),
  ]);
  const filas = contexto.seleccion
    ? inventario.filas.filter((fila) => fila.sucursalId === contexto.seleccion)
    : inventario.filas;
  const grupos = agruparPorCategoria(filas);
  const bajos = resumenStockBajo(grupos);
  const lectura = contexto.staff.rol === "vendedor" || !contexto.vigente;
  const exportar = contexto.seleccion
    ? `/api/t/${contexto.tienda.slug}/inventario/csv?sucursal=${contexto.seleccion}`
    : `/api/t/${contexto.tienda.slug}/inventario/csv`;

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Inventario</h2>
      {lectura ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {contexto.staff.rol === "vendedor"
            ? "Puedes consultar el stock. Los cambios los hace el dueño o el gerente."
            : "La licencia no está vigente. El inventario está en solo lectura."}
        </p>
      ) : null}
      {bajos.length > 0 ? (
        <section aria-labelledby="alerta-stock" className="rounded-xl border border-amber-700/40 p-4 dark:border-amber-300/40">
          <h3 id="alerta-stock" className="text-base font-semibold">
            Stock bajo
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {bajos.map((item) => (
              <li key={item.categoria}>
                {item.categoria}: {item.bajos}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {filas.length === 0 ? (
        <EmptyState
          titulo="No hay productos en esta sucursal"
          descripcion="Ofrece un producto en la sucursal para llevar su stock."
        />
      ) : (
        <InventarioPanel
          slug={contexto.tienda.slug}
          lectura={lectura}
          grupos={grupos}
          sucursales={inventario.sucursales.map((sucursal) => ({ id: sucursal.id, nombre: sucursal.nombre }))}
          exportarHref={exportar}
        />
      )}
    </main>
  );
}
