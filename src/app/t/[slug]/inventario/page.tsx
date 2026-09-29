import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// El stock ahora se ve y se agrega desde Productos.
export default async function InventarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/productos`);
}
