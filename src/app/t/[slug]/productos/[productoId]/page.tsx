import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// Los productos se editan desde el menú ⋮ de cada tarjeta en Productos.
export default async function EditarProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/productos`);
}
