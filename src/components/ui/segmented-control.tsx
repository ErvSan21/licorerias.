"use client";

import type { KeyboardEvent } from "react";

import { cx } from "@/components/ui/tokens";

export function SegmentedControl<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: T;
  opciones: readonly { valor: T; etiqueta: string }[];
  onChange: (valor: T) => void;
}) {
  function alTecla(event: KeyboardEvent<HTMLDivElement>) {
    const actual = opciones.findIndex((opcion) => opcion.valor === valor);
    if (actual < 0) return;
    const adelante = event.key === "ArrowRight" || event.key === "ArrowDown";
    const atras = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!adelante && !atras) return;
    event.preventDefault();
    const delta = adelante ? 1 : -1;
    const indice = (actual + delta + opciones.length) % opciones.length;
    onChange(opciones[indice].valor);
    const botones = event.currentTarget.querySelectorAll("button");
    botones[indice]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={etiqueta} className="ui-segmento" onKeyDown={alTecla}>
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            className={cx("ui-boton ui-movimiento", activo && "ui-segmento-activo")}
            onClick={() => onChange(opcion.valor)}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
