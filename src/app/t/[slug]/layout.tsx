import { salir } from "@/app/login/actions";
import { BotonPendiente } from "@/components/boton-pendiente";
import { AccesoError } from "@/lib/auth/errors";
import { exigirPanel } from "@/lib/auth/panel";
import { etiquetaEstado, etiquetaRol } from "@/lib/tenant";

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const contexto = await leerPanel(slug);

  if (contexto === "configuracion") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="mt-3 text-sm leading-6">Falta la configuración de Supabase en el servidor.</p>
      </main>
    );
  }

  const { tienda, staff } = contexto;

  return (
    <div className="flex min-h-full flex-1 flex-col">
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
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}

async function leerPanel(slug: string) {
  try {
    return await exigirPanel(slug);
  } catch (error) {
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return "configuracion" as const;
    }
    throw error;
  }
}
