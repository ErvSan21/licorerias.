"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErrorAdministracion({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      titulo="No se pudo cargar la administración"
      descripcion="Revisa la conexión e inténtalo de nuevo."
      onRetry={reset}
    />
  );
}
