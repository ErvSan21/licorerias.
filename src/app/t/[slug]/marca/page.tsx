import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// La marca ahora vive en Configuración.
export default async function MarcaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/configuracion/marca`);
}
