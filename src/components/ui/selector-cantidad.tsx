"use client";

export function SelectorCantidad({
  valor,
  onChange,
  min = 0,
  max = 99,
  etiqueta = "Cantidad",
}: {
  valor: number;
  onChange: (valor: number) => void;
  min?: number;
  max?: number;
  etiqueta?: string;
}) {
  const enMinimo = valor <= min;
  const enMaximo = valor >= max;

  return (
    <div className="ui-cantidad" role="group" aria-label={etiqueta}>
      <button
        type="button"
        className="ui-boton ui-boton-primario ui-movimiento"
        aria-label="Quitar uno"
        disabled={enMinimo}
        aria-disabled={enMinimo || undefined}
        onClick={() => onChange(Math.max(min, valor - 1))}
      >
        −
      </button>
      <span className="ui-cantidad-valor tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        className="ui-boton ui-boton-primario ui-movimiento"
        aria-label="Agregar uno"
        disabled={enMaximo}
        aria-disabled={enMaximo || undefined}
        onClick={() => onChange(Math.min(max, valor + 1))}
      >
        +
      </button>
    </div>
  );
}
