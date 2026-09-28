import { redirect, unstable_rethrow } from "next/navigation";

import { salir } from "@/app/login/actions";
import { BotonPendiente } from "@/components/boton-pendiente";
import { NavPlataforma } from "@/components/super/nav-plataforma";
import { AccesoError, mensajeAcceso } from "@/lib/auth/errors";
import { requireSuperAdmin } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AccesoError && error.codigo === "no_autenticado") {
      redirect("/login?siguiente=/super");
    }
    if (error instanceof AccesoError && error.codigo === "prohibido") {
      redirect("/login");
    }
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return (
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="mt-3 text-sm leading-6">{mensajeAcceso("configuracion")}</p>
        </main>
      );
    }
    throw error;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Plataforma</p>
            <p className="text-lg font-semibold tracking-tight">Licorerías</p>
          </div>
          <NavPlataforma />
          <form action={salir} className="sm:w-40">
            <BotonPendiente idle="Salir" pending="Saliendo…" variant="contorno" />
          </form>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</div>
    </div>
  );
}
