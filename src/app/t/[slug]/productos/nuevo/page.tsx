import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// Los productos se crean desde la hoja "Agregar producto" de Productos.
export default async function NuevoProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/productos`);
}
