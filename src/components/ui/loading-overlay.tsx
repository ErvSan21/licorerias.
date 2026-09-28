"use client";

import { Spinner } from "@/components/ui/spinner";
import { useCargaVisible } from "@/components/ui/use-carga-visible";

export function LoadingOverlay({
  activo,
  etiqueta = "Guardando…",
}: {
  activo: boolean;
  etiqueta?: string;
}) {
  const visible = useCargaVisible(activo);
  if (!activo && !visible) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 px-4 dark:bg-zinc-950/80"
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      {visible ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Spinner size="sm" />
          {etiqueta}
        </span>
      ) : (
        <span className="sr-only">{etiqueta}</span>
      )}
    </div>
  );
}
