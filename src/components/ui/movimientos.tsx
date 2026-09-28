"use client";

import { useState } from "react";

import { cx } from "@/components/ui/tokens";

export function EntradaLista({ indice, children }: { indice: number; children: React.ReactNode }) {
  const anima = indice < 8;
  return (
    <li
      className={anima ? "ui-entrada-item ui-movimiento" : undefined}
      style={anima ? { animationDelay: `${indice * 40}ms` } : undefined}
    >
      {children}
    </li>
  );
}

export function ResalteFila({ clave, children }: { clave: number; children: React.ReactNode }) {
  return (
    <div className="relative">
      {clave > 0 ? (
        <span
          key={clave}
          aria-hidden="true"
          className="ui-resalte pointer-events-none absolute inset-0 rounded-lg bg-[var(--color-primario)]"
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

export function useSalto() {
  const [ciclo, setCiclo] = useState(0);
  return {
    ciclo,
    saltar() {
      setCiclo((valor) => valor + 1);
    },
  };
}

export function IconoConSalto({ ciclo, children }: { ciclo: number; children: React.ReactNode }) {
  return (
    <span key={ciclo} className={cx("inline-flex", ciclo > 0 && "ui-rebote ui-movimiento")}>
      {children}
    </span>
  );
}

export function LineaTiempo({ pasos, actual }: { pasos: readonly string[]; actual: number }) {
  const tope = Math.max(pasos.length - 1, 1);
  const progreso = Math.min(Math.max(actual, 0), tope) / tope;
  return (
    <div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
        <div
          className="ui-linea-avance h-full origin-left bg-[var(--color-primario)]"
          style={{ transform: `scaleX(${progreso})` }}
        />
      </div>
      <ol className="flex flex-col gap-2">
        {pasos.map((paso, indice) => (
          <li key={paso} aria-current={indice === actual ? "step" : undefined} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={cx(
                "h-2.5 w-2.5 rounded-full",
                indice <= actual ? "bg-[var(--color-primario)]" : "bg-zinc-300 dark:bg-zinc-700",
              )}
            />
            <span className={indice === actual ? "font-medium" : "text-zinc-600 dark:text-zinc-400"}>{paso}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ResultadosAtenuados({
  actualizando,
  children,
}: {
  actualizando: boolean;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy={actualizando || undefined} className={actualizando ? "ui-atenuado" : undefined}>
      {children}
    </div>
  );
}
