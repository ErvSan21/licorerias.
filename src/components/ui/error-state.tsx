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
    <div className="ui-error" role="alert">
      <h3 className="text-base">{titulo}</h3>
      <p className="text-sm leading-6 text-[var(--mu)]">{descripcion}</p>
      <Button type="button" variant="secundario" onClick={onRetry}>
        {etiqueta}
      </Button>
    </div>
  );
}
