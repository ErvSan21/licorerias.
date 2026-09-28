"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({
  titulo = "No se pudo cargar",
  descripcion = "Revisa la conexión e inténtalo de nuevo.",
  onRetry,
  etiqueta = "Reintentar",
}: {
  titulo?: string;
  descripcion?: string;
  onRetry: () => void;
  etiqueta?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 px-4 py-6 dark:border-red-900" role="alert">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{descripcion}</p>
      <Button type="button" variant="secundario" onClick={onRetry}>
        {etiqueta}
      </Button>
    </div>
  );
}
