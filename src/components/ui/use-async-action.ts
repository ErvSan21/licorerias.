"use client";

import { useState } from "react";

import { crearGuardiaAccion, type ResultadoGuardia } from "@/components/ui/async-guard";

export function useAsyncAction<T>(fn: () => Promise<T>) {
  const [guardia] = useState(crearGuardiaAccion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function run(): Promise<ResultadoGuardia<{ ok: true; valor: T } | { ok: false }>> {
    return guardia.ejecutar(async () => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const valor = await fn();
        setSuccess(true);
        return { ok: true as const, valor };
      } catch (causa) {
        const mensaje =
          causa instanceof Error && causa.message
            ? causa.message
            : "No se pudo completar. Inténtalo de nuevo.";
        setError(mensaje);
        setSuccess(false);
        return { ok: false as const };
      } finally {
        setLoading(false);
      }
    });
  }

  return { run, loading, error, success };
}
