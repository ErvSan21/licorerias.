import { redirect } from "next/navigation";

import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
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

  return (
    <main className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {elegida
          ? `Estás viendo ${elegida.nombre}.`
          : contexto.staff.rol === "dueno"
            ? "Estás viendo todas las sucursales."
            : "Todavía no tienes una sucursal asignada."}
      </p>
    </main>
  );
}
