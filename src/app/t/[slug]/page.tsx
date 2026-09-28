import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { TiendaNoDisponible } from "@/components/tienda-no-disponible";
import { AccesoError } from "@/lib/auth/errors";
import { contextoPanel, resolveTenantBySlug } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { licenciaVigente } from "@/lib/licencias/servicio";
import { normalizarSlug, slugReservado, slugValido } from "@/lib/tenant";

export default async function PanelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  const anonimo = await visitaAnonima(normalizado);
  if (anonimo === "no_disponible") return <TiendaNoDisponible slug={normalizado} />;
  if (anonimo === "no_encontrado") notFound();
  if (anonimo === "configuracion") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="mt-3 text-sm leading-6">Falta la configuración de Supabase en el servidor.</p>
      </main>
    );
  }
  if (anonimo === "login") {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}`)}`);
  }

  const contexto = await contextoPanel(normalizado);
  const elegida = contexto.sucursales.find((sucursal) => sucursal.id === contexto.seleccion);

  return (
    <main className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Inicio</h2>
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

async function visitaAnonima(slug: string) {
  if (!slugValido(slug) || slugReservado(slug)) return "no_encontrado" as const;
  try {
    const user = await usuarioVerificado();
    if (user) return "sesion" as const;
    const tienda = await resolveTenantBySlug(slug);
    if (!tienda) return "no_encontrado" as const;
    const vigente = await licenciaVigente(tienda.id);
    return vigente ? ("login" as const) : ("no_disponible" as const);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return "configuracion" as const;
    }
    throw error;
  }
}
