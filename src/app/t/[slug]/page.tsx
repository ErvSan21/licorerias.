import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { salir } from "@/app/login/actions";
import { AvisoSoloLectura } from "@/components/aviso-solo-lectura";
import { BotonPendiente } from "@/components/boton-pendiente";
import { TiendaNoDisponible } from "@/components/tienda-no-disponible";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { cargarPanel, resolveTenantBySlug } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { licenciaVigente } from "@/lib/licencias/servicio";
import { etiquetaEstado, etiquetaRol, normalizarSlug, slugReservado, slugValido } from "@/lib/tenant";

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

  const contexto = await leerPanel(normalizado);

  if (contexto === "no_encontrado") notFound();
  if (contexto === "login") {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}`)}`);
  }

  if (contexto === "configuracion") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="mt-3 text-sm leading-6">Falta la configuración de Supabase en el servidor.</p>
      </main>
    );
  }

  const { tienda, staff, vigente } = contexto;

  return (
    <>
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Licorerías</p>
            <h1 className="text-xl font-semibold tracking-tight">{tienda.nombre}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {etiquetaRol(staff.rol)} · {etiquetaEstado(tienda.estado)}
            </p>
          </div>
          <nav aria-label="Panel">
            <span className="text-sm font-medium" aria-current="page">
              Inicio
            </span>
          </nav>
          <form action={salir} className="sm:max-w-40">
            <BotonPendiente idle="Salir" pending="Saliendo…" variant="contorno" />
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-6">
        {vigente ? null : <AvisoSoloLectura />}
        <h2 className="text-lg font-semibold">Inicio</h2>
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Sesión de {etiquetaRol(staff.rol)} en {tienda.nombre}. El catálogo, las sucursales y los
          pedidos llegan en los módulos siguientes.
        </p>
      </main>
    </>
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

async function leerPanel(slug: string) {
  try {
    return await cargarPanel(slug);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado) return "no_encontrado" as const;
    if (error instanceof AccesoError && error.codigo === "prohibido") {
      return "no_encontrado" as const;
    }
    if (error instanceof AccesoError && error.codigo === "no_autenticado") {
      return "login" as const;
    }
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return "configuracion" as const;
    }
    throw error;
  }
}
