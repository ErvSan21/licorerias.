import { FormularioAlta } from "@/components/super/formulario-alta";
import { listarPlanes } from "@/lib/licencias/servicio";

export default async function NuevaTiendaPage() {
  const planes = await listarPlanes();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva tienda</h1>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Crea la tienda, una licencia de prueba y la invitación del dueño.
        </p>
      </div>
      <FormularioAlta
        planes={planes.map((plan) => ({
          id: plan.id,
          nombre: plan.nombre,
          precioMensual: plan.precioMensual,
        }))}
      />
    </main>
  );
}
