import { notFound, unstable_rethrow } from "next/navigation";

import { TiendaNoDisponible } from "@/components/tienda-no-disponible";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { TiendaCerrada } from "@/lib/tienda/servicio";

export function falloPublico(error: unknown, slug: string) {
  unstable_rethrow(error);
  if (error instanceof NoEncontrado) notFound();
  if (error instanceof TiendaCerrada) return <TiendaNoDisponible slug={slug} />;
  if (error instanceof AccesoError && error.codigo === "configuracion") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="mt-3 text-sm leading-6">Falta la configuración de Supabase en el servidor.</p>
      </main>
    );
  }
  throw error;
}
