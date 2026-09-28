"use client";

import { Spinner } from "@/components/ui/spinner";
import { useCargaVisible } from "@/components/ui/use-carga-visible";

export function InlineLoader({
  activo = true,
  children = "Cargando…",
}: {
  activo?: boolean;
  children?: React.ReactNode;
}) {
  const visible = useCargaVisible(activo);
  if (!activo && !visible) return null;

  return (
    <span className="inline-flex min-h-6 items-center gap-2 text-sm" role="status" aria-live="polite" aria-busy="true">
      {visible ? (
        <>
          <Spinner size="sm" />
          <span>{children}</span>
        </>
      ) : (
        <span className="sr-only">{children}</span>
      )}
    </span>
  );
}
