"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErrorSuper({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      titulo="No se pudo cargar el panel"
      descripcion="Revisa la conexión e inténtalo de nuevo."
      onRetry={reset}
    />
  );
}
