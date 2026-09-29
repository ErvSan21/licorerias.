import { redirect } from "next/navigation";

import { normalizarSlug } from "@/lib/tenant";

// Las sucursales nuevas las agrega el super admin desde Administración.
export default async function NuevaSucursalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/t/${normalizarSlug(slug)}/sucursales`);
}
