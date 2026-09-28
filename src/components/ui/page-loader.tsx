"use client";

import { Spinner } from "@/components/ui/spinner";
import { useCargaVisible } from "@/components/ui/use-carga-visible";

export function PageLoader({
  activo = true,
  nombre = "Licorerías",
  logo,
}: {
  activo?: boolean;
  nombre?: string;
  logo?: React.ReactNode;
}) {
  const visible = useCargaVisible(activo);
  if (!activo && !visible) return null;

  return (
    <div
      className="ui-anclado-inferior fixed inset-0 z-[90] flex items-center justify-center bg-white px-6 pt-[env(safe-area-inset-top)] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      {visible ? (
        <div className="flex flex-col items-center gap-4">
          {logo ?? <MarcaTexto nombre={nombre} />}
          <Spinner size="lg" />
          <p>Cargando…</p>
        </div>
      ) : (
        <p className="sr-only">Cargando…</p>
      )}
    </div>
  );
}

function MarcaTexto({ nombre }: { nombre: string }) {
  return (
    <p translate="no" className="text-2xl font-semibold tracking-tight text-[var(--color-primario)]">
      {nombre}
    </p>
  );
}
