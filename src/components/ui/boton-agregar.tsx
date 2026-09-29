"use client";

/** Botón redondo "+" de la esquina superior derecha para crear algo. */
export function BotonAgregar({ etiqueta, alTocar }: { etiqueta: string; alTocar: () => void }) {
  return (
    <button type="button" className="boton-agregar" aria-label={etiqueta} onClick={alTocar}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
