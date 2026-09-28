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
      className="ui-anclado-inferior fixed inset-0 z-[90] flex items-center justify-center bg-[var(--bg)] px-6 pt-[env(safe-area-inset-top)] text-[var(--tx)]"
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
    <p translate="no" className="font-display text-2xl font-extrabold tracking-tight text-[var(--br)]">
      {nombre}
    </p>
  );
}
