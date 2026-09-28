"use client";

import { useId, useRef } from "react";

import { cx } from "@/components/ui/tokens";
import { useFocoDialogo } from "@/components/ui/use-foco-dialogo";
import { usePresencia } from "@/components/ui/use-presencia";

export function Dialogo({
  abierto,
  titulo,
  descripcion,
  alCerrar,
  bloquearCierre = false,
  alineacion,
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  alCerrar: () => void;
  bloquearCierre?: boolean;
  alineacion: "centro" | "inferior";
  children: React.ReactNode;
}) {
  const tituloId = useId();
  const descripcionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { montado, visible } = usePresencia(abierto);
  useFocoDialogo(montado, panel, alCerrar, bloquearCierre);

  if (!montado) return null;

  return (
    <div
      className={cx(
        "fixed inset-0 z-[60] flex px-4",
        alineacion === "inferior" ? "ui-anclado-inferior items-end" : "items-center justify-center py-8",
      )}
    >
      <div
        className="ui-fondo absolute inset-0 bg-[var(--ui-overlay)]"
        data-abierto={visible ? "true" : "false"}
        onClick={() => {
          if (!bloquearCierre) alCerrar();
        }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? descripcionId : undefined}
        aria-busy={bloquearCierre || undefined}
        tabIndex={-1}
        data-abierto={visible ? "true" : "false"}
        className={cx(
          "ui-dialogo ui-movimiento relative z-[1] w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
          alineacion === "inferior" && "origin-bottom",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={tituloId} className="text-lg font-semibold tracking-tight">
            {titulo}
          </h2>
          <button
            type="button"
            className="ui-boton min-h-11 min-w-11 rounded-lg px-3 text-sm"
            onClick={alCerrar}
            disabled={bloquearCierre}
            aria-disabled={bloquearCierre || undefined}
          >
            Cerrar
          </button>
        </div>
        {descripcion ? (
          <p id={descripcionId} className="mb-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {descripcion}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
