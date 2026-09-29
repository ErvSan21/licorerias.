import { redirect } from "next/navigation";

import { DashboardPanel } from "@/components/panel/dashboard-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerDashboard } from "@/lib/panel/dashboard-servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PanelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/panel`)}`);
  }

  const contexto = await contextoPanel(normalizado);
  const elegida = contexto.sucursales.find((sucursal) => sucursal.id === contexto.seleccion);
  const datos = await leerDashboard(contexto);

  return <DashboardPanel datos={datos} sucursal={elegida?.nombre ?? null} slug={contexto.tienda.slug} />;
}
