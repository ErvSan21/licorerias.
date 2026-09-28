"use client";

import { useEffect, useState } from "react";

export const claseCampo =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function useAvisoSalida() {
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    if (!sucio) return;
    const salir = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", salir);
    return () => window.removeEventListener("beforeunload", salir);
  }, [sucio]);

  return {
    marcarSucio: () => setSucio(true),
    limpiar: () => setSucio(false),
  };
}

export function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
