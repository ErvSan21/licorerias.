import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioCategoria } from "@/components/panel/formulario-producto";
import { EmptyState } from "@/components/ui/empty-state";
import { ImagenConCarga } from "@/components/ui/imagen";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import { formatoBs } from "@/lib/catalogo/reglas";
import { normalizarSlug } from "@/lib/tenant";

export default async function ProductosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos`)}`);
  }
  const [contexto, catalogo] = await Promise.all([contextoPanel(normalizado), listarCatalogo(normalizado)]);
  const dueno = contexto.staff.rol === "dueno";
  const productos = contexto.seleccion
    ? catalogo.productos.filter((producto) =>
        producto.ofertas.some(
          (oferta) => oferta.sucursalId === contexto.seleccion && (dueno || oferta.disponible),
        ),
      )
    : catalogo.productos;

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Productos</h2>
        {dueno ? (
          <Link
            href={`/t/${contexto.tienda.slug}/productos/nuevo`}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            Nuevo producto
          </Link>
        ) : null}
      </div>
      {dueno ? <FormularioCategoria slug={contexto.tienda.slug} lectura={!contexto.vigente} /> : null}
      {productos.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay productos"
          descripcion={dueno ? "Crea el primero y elige en qué sucursales se ofrece." : "No hay productos en esta sucursal."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {productos.map((producto) => {
            const precio = producto.ofertas.find((oferta) => oferta.precioEfectivo != null)?.precioEfectivo;
            return (
              <li
                key={producto.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 280px" }}
              >
                {producto.imagenUrl ? (
                  <ImagenConCarga src={producto.imagenUrl} alt={producto.nombre} className="aspect-[4/3]" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    Sin imagen
                  </div>
                )}
                <div>
                  {dueno ? (
                    <Link
                      href={`/t/${contexto.tienda.slug}/productos/${producto.id}`}
                      className="inline-flex min-h-11 touch-manipulation items-center break-words font-semibold underline-offset-4 hover:underline"
                    >
                      {producto.nombre}
                    </Link>
                  ) : (
                    <p className="break-words font-semibold">{producto.nombre}</p>
                  )}
                  {producto.categoria ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{producto.categoria}</p> : null}
                  <p className="text-sm tabular-nums">
                    {precio == null ? formatoBs(producto.precioCentral) : formatoBs(precio)}
                  </p>
                  {producto.activo ? null : <p className="text-sm">Inactivo</p>}
                </div>
                <Link
                  href={`/t/${contexto.tienda.slug}/productos/${producto.id}/historial`}
                  className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline underline-offset-4"
                >
                  Historial de precios
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
