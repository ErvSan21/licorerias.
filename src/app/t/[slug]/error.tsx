"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErrorPanel({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <ErrorState
        titulo="No se pudo abrir el panel"
        descripcion="Inténtalo de nuevo. Si sigue fallando, vuelve a entrar."
        onRetry={reset}
      />
    </main>
  );
}
