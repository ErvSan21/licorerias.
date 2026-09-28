import { redirect } from "next/navigation";

import { ColeccionesPanel } from "@/components/panel/colecciones-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarColecciones } from "@/lib/ofertas/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function ColeccionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/colecciones`)}`);
  }
  const [contexto, lista] = await Promise.all([
    contextoPanel(normalizado),
    listarColecciones(normalizado),
  ]);
  const lectura = contexto.staff.rol !== "dueno" || !contexto.vigente;

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Colecciones</h2>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Agrupa productos por temporada. En la tienda pública solo aparecen los que esa sucursal ofrece y mientras la
        colección esté vigente.
      </p>
      {lectura ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {contexto.staff.rol === "dueno"
            ? "La licencia no está vigente. Las colecciones están en solo lectura."
            : "Las colecciones las crea el dueño."}
        </p>
      ) : null}
      {lista.colecciones.length === 0 && lectura ? (
        <EmptyState titulo="No hay colecciones" descripcion="El dueño puede armar una para Navidad, Carnaval o el fin de semana." />
      ) : (
        <ColeccionesPanel
          slug={contexto.tienda.slug}
          lectura={lectura}
          colecciones={lista.colecciones}
          productos={lista.productos}
        />
      )}
    </main>
  );
}
