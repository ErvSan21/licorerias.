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
          className="ui-resalte pointer-events-none absolute inset-0 rounded-[12px] bg-[var(--br)]"
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

export function LineaTiempo({
  pasos,
  actual,
  ciclo = 0,
}: {
  pasos: readonly string[];
  actual: number;
  ciclo?: number;
}) {
  const tope = Math.max(pasos.length - 1, 1);
  const progreso = Math.min(Math.max(actual, 0), tope) / tope;
  return (
    <div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-[var(--sf2)]" aria-hidden="true">
        <div
          className="ui-linea-avance ui-punto h-full origin-left"
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
                indice <= actual ? "ui-punto" : "bg-[var(--ln)]",
              )}
            />
            <span
              key={indice === actual ? `actual-${ciclo}` : paso}
              className={
                indice === actual
                  ? ciclo > 0
                    ? "seguimiento-paso ui-movimiento font-medium"
                    : "font-medium"
                  : "text-[var(--mu)]"
              }
            >
              {paso}
            </span>
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
