import { redirect } from "next/navigation";

import { OfertasLista, type OfertaFila, type ProductoOferta } from "@/components/panel/ofertas-lista";
import { PestanasProductos } from "@/components/panel/pestanas-productos";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import type { EstadoOferta } from "@/lib/ofertas/reglas";
import { listarOfertas } from "@/lib/ofertas/servicio";
import { normalizarSlug } from "@/lib/tenant";

const ORDEN: Record<EstadoOferta, number> = { vigente: 0, programada: 1, inactiva: 2, vencida: 3 };

export default async function OfertasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/ofertas`)}`);
  }
  const [contexto, lista, catalogo] = await Promise.all([
    contextoPanel(normalizado),
    listarOfertas(normalizado),
    listarCatalogo(normalizado),
  ]);

  // La oferta se crea en la sucursal elegida; si no hay una elegida, en la central.
  const ordenadas = contexto.sucursales.toSorted(
    (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"),
  );
  const sucursal =
    ordenadas.find((item) => item.id === contexto.seleccion) ?? ordenadas.find((item) => item.activa) ?? null;
  const lectura = contexto.staff.rol === "vendedor" || !contexto.vigente;

  if (!sucursal) {
    return (
      <main className="flex flex-col gap-4">
        <PestanasProductos slug={contexto.tienda.slug} activa="ofertas" />
        <EmptyState titulo="Elige una sucursal" descripcion="Ábrela desde el perfil, arriba a la derecha." />
      </main>
    );
  }

  // Precio normal de cada producto en esta sucursal, sin ofertas.
  const precios = new Map<string, number>();
  const productos: ProductoOferta[] = [];
  for (const producto of catalogo.productos) {
    const oferta = producto.ofertas.find((item) => item.sucursalId === sucursal.id && item.disponible);
    if (!oferta) continue;
    const precio = oferta.precioEfectivo ?? producto.precioCentral;
    precios.set(producto.id, precio);
    if (producto.activo) productos.push({ id: producto.id, nombre: producto.nombre, precio });
  }

  const ofertas: OfertaFila[] = lista.ofertas
    .filter((oferta) => (oferta.sucursalId === null || oferta.sucursalId === sucursal.id) && precios.has(oferta.productoId))
    .map((oferta) => {
      const antes = precios.get(oferta.productoId) ?? 0;
      const despues =
        oferta.tipo === "precio_fijo" ? oferta.valor : Math.round(antes * (1 - oferta.valor / 100) * 100) / 100;
      return {
        id: oferta.id,
        producto: oferta.producto,
        precioAntes: antes,
        precioOferta: Math.min(antes, despues),
        inicio: oferta.inicio,
        fin: oferta.fin,
        estado: oferta.estado,
      };
    })
    .toSorted((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || b.inicio.localeCompare(a.inicio));

  return (
    <main className="flex flex-col gap-4">
      <PestanasProductos slug={contexto.tienda.slug} activa="ofertas" />
      <OfertasLista
        slug={contexto.tienda.slug}
        sucursal={{ id: sucursal.id, nombre: sucursal.nombre }}
        ofertas={ofertas}
        productos={productos.toSorted((a, b) => a.nombre.localeCompare(b.nombre, "es"))}
        puedeCrear={!lectura}
      />
    </main>
  );
}
