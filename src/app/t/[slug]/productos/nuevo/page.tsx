import { notFound, redirect } from "next/navigation";

import { FormularioNuevoProducto } from "@/components/panel/formulario-producto";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function NuevoProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos/nuevo`)}`);
  }
  const [contexto, catalogo] = await Promise.all([contextoPanel(normalizado), listarCatalogo(normalizado)]);
  if (contexto.staff.rol !== "dueno") notFound();

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Nuevo producto</h2>
      <FormularioNuevoProducto
        slug={contexto.tienda.slug}
        lectura={!contexto.vigente}
        categorias={catalogo.categorias}
        sucursales={catalogo.sucursales}
      />
    </main>
  );
}
