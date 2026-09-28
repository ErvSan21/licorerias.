import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { FormularioEditarProducto } from "@/components/panel/formulario-producto";
import { NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerProducto } from "@/lib/catalogo/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ slug: string; productoId: string }>;
}) {
  const { slug, productoId } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos/${productoId}`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();

  let producto;
  let categorias;
  let sucursales;
  try {
    const leido = await leerProducto(normalizado, productoId);
    producto = leido.producto;
    categorias = leido.catalogo.categorias;
    sucursales = leido.catalogo.sucursales;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado) notFound();
    throw error;
  }

  return (
    <main className="flex flex-col gap-4">
      <h2 className="break-words text-lg font-semibold">{producto.nombre}</h2>
      <FormularioEditarProducto
        slug={contexto.tienda.slug}
        lectura={!contexto.vigente}
        categorias={categorias}
        sucursales={sucursales}
        producto={producto}
      />
    </main>
  );
}
