import { redirect } from "next/navigation";

import { ListaVentas } from "@/components/panel/lista-ventas";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoBs } from "@/lib/catalogo/reglas";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function VentasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/ventas`)}`);
  }

  const [contexto, catalogo] = await Promise.all([contextoPanel(normalizado), listarCatalogo(normalizado)]);
  const ordenadas = contexto.sucursales.toSorted(
    (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"),
  );
  const idCentral = ordenadas[0]?.id ?? null;
  const activas = ordenadas.filter((sucursal) => sucursal.activa || sucursal.id === contexto.seleccion);
  const sucursalId = contexto.seleccion ?? activas.find((sucursal) => sucursal.id === idCentral)?.id ?? activas[0]?.id ?? null;
  const sucursal = activas.find((item) => item.id === sucursalId) ?? null;
  const tituloSucursal = sucursal ? (sucursal.id === idCentral ? "La central" : sucursal.nombre) : null;
  const productos = sucursal
    ? catalogo.productos.flatMap((producto) => {
        if (!producto.activo) return [];
        const oferta = producto.ofertas.find((item) => item.sucursalId === sucursal.id && item.disponible);
        if (!oferta) return [];
        return [
          {
            id: producto.id,
            nombre: producto.nombre,
            precio: formatoBs(oferta.precioEfectivo ?? producto.precioCentral),
          },
        ];
      })
    : [];

  return (
    <main className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Ventas</h2>
        {tituloSucursal ? <p className="mt-1 text-sm text-[var(--mu)]">{tituloSucursal}</p> : null}
      </div>
      {sucursal ? (
        <ListaVentas productos={productos} />
      ) : (
        <EmptyState titulo="Elige una sucursal" descripcion="Ábrela desde el perfil, arriba a la derecha." />
      )}
    </main>
  );
}
