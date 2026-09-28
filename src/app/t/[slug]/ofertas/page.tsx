import { redirect } from "next/navigation";

import { OfertasPanel } from "@/components/panel/ofertas-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarOfertas } from "@/lib/ofertas/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function OfertasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/ofertas`)}`);
  }
  const [contexto, lista] = await Promise.all([contextoPanel(normalizado), listarOfertas(normalizado)]);
  const ofertas = contexto.seleccion
    ? lista.ofertas.filter((oferta) => oferta.sucursalId === null || oferta.sucursalId === contexto.seleccion)
    : lista.ofertas;
  const lectura = contexto.staff.rol === "vendedor" || !contexto.vigente;
  const puedeTienda = contexto.staff.rol === "dueno" && contexto.vigente;

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Ofertas</h2>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        El precio de venta usa la oferta vigente más baja. El porcentaje se calcula sobre el precio de cada sucursal.
        El precio fijo es de una sola sucursal.
      </p>
      {lectura ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {contexto.staff.rol === "vendedor"
            ? "Puedes consultar las ofertas. Los cambios los hace el dueño o el gerente."
            : "La licencia no está vigente. Las ofertas están en solo lectura."}
        </p>
      ) : null}
      {ofertas.length === 0 && lectura ? (
        <EmptyState titulo="No hay ofertas" descripcion="Cuando haya una oferta vigente, el precio de venta la tendrá en cuenta." />
      ) : (
        <OfertasPanel
          slug={contexto.tienda.slug}
          lectura={lectura}
          puedeTienda={puedeTienda}
          ofertas={ofertas}
          productos={lista.productos}
          sucursales={lista.sucursales}
          disponibilidad={lista.disponibilidad}
          sucursalFija={contexto.staff.rol === "dueno" ? null : contexto.seleccion}
        />
      )}
    </main>
  );
}
