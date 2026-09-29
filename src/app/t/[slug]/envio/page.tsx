import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// El envío ahora vive en Configuración.
export default async function EnvioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/configuracion/envio`);
}
