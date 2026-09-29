"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/ui/tokens";
import { useFocoDialogo } from "@/components/ui/use-foco-dialogo";
import { usePresencia } from "@/components/ui/use-presencia";

/** Colores de marca que la tienda aplica en un contenedor; el portal los lleva consigo. */
const VARIABLES_MARCA = ["--br", "--br2", "--gr", "--brt", "--color-primario", "--color-sobre-primario"] as const;

/**
 * Los diálogos se dibujan en <body> (portal). Así ningún contenedor los recorta:
 * content-visibility, overflow, transform o filter en una tarjeta atrapaban el
 * `position: fixed` y la hoja se veía cortada dentro de la tarjeta.
 */
function usePortal(montado: boolean) {
  const ancla = useRef<HTMLSpanElement>(null);
  const [marca, setMarca] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!montado || !ancla.current) return;
    const estilo = getComputedStyle(ancla.current);
    const valores: Record<string, string> = {};
    for (const nombre of VARIABLES_MARCA) {
      const valor = estilo.getPropertyValue(nombre).trim();
      if (valor) valores[nombre] = valor;
    }
    setMarca(valores as CSSProperties);
  }, [montado]);

  return { ancla, marca, listo: marca !== null };
}

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
  const { ancla, marca, listo } = usePortal(montado);
  // El foco se activa cuando el panel ya está en su lugar definitivo (el portal).
  useFocoDialogo(montado && listo, panel, alCerrar, bloquearCierre);

  if (!montado) return null;

  // Primer render (y el del servidor): solo el ancla, para leer los colores de marca.
  if (!listo) return <span ref={ancla} hidden />;

  return createPortal(
    <div
      style={marca ?? undefined}
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
          "ui-dialogo ui-dialogo-panel ui-movimiento relative z-[1] w-full max-w-md p-4",
          alineacion === "inferior" && "ui-hoja origin-bottom",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={tituloId} className="text-lg tracking-tight">
            {titulo}
          </h2>
          <button
            type="button"
            className="boton-cerrar"
            aria-label="Cerrar"
            onClick={alCerrar}
            disabled={bloquearCierre}
            aria-disabled={bloquearCierre || undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {descripcion ? (
          <p id={descripcionId} className="mb-4 text-sm leading-6 text-[var(--mu)]">
            {descripcion}
          </p>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
