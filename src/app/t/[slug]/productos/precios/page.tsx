import { redirect } from "next/navigation";

import { AccionesMasivasPrecio, ConfiguracionPrecios } from "@/components/panel/acciones-precio";
import { ListaPreciosGerente, TablaPreciosDueno, TablaPreciosLectura } from "@/components/panel/tabla-precios";
import { EmptyState } from "@/components/ui/empty-state";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PreciosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos/precios`)}`);
  }
  const [contexto, catalogo] = await Promise.all([contextoPanel(normalizado), listarCatalogo(normalizado)]);
  const lectura = !contexto.vigente;
  const sucursalGerente = contexto.seleccion ?? catalogo.sucursales[0]?.id ?? null;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Precios por sucursal</h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {contexto.staff.rol === "dueno"
            ? "Cada columna es una sucursal. Central se comparte. Propio vale solo ahí."
            : "Puedes usar el precio central o fijar el de tu sucursal."}
        </p>
      </div>
      {catalogo.productos.length === 0 ? (
        <EmptyState titulo="Todavía no hay productos" descripcion="Cuando haya productos, aquí se ven sus precios." />
      ) : contexto.staff.rol === "dueno" ? (
        <TablaPreciosDueno
          slug={contexto.tienda.slug}
          lectura={lectura}
          productos={catalogo.productos}
          sucursales={catalogo.sucursales}
        />
      ) : contexto.staff.rol === "gerente" && sucursalGerente ? (
        <ListaPreciosGerente
          slug={contexto.tienda.slug}
          lectura={lectura}
          productos={catalogo.productos}
          sucursalId={sucursalGerente}
          permitenPrecioPropio={catalogo.permitenPrecioPropio}
          margenMax={catalogo.margenMax}
        />
      ) : (
        <TablaPreciosLectura productos={catalogo.productos} sucursales={catalogo.sucursales} />
      )}
      {contexto.staff.rol === "dueno" ? (
        <>
          <ConfiguracionPrecios
            slug={contexto.tienda.slug}
            lectura={lectura}
            permiten={catalogo.permitenPrecioPropio}
            margen={catalogo.margenMax}
          />
          <AccionesMasivasPrecio
            slug={contexto.tienda.slug}
            lectura={lectura}
            sucursales={catalogo.sucursales}
            categorias={catalogo.categorias}
          />
        </>
      ) : null}
    </main>
  );
}
