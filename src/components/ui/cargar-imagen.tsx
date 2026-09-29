"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Zona para cargar una imagen: tocar o arrastrar, con vista previa.
 * `actual` es la imagen ya guardada; `onChange(null)` vuelve a ella.
 */
export function CargarImagen({
  actual = null,
  onChange,
  deshabilitado = false,
}: {
  actual?: string | null;
  onChange: (archivo: File | null) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const mostrada = vista ?? actual;

  useEffect(() => {
    return () => {
      if (vista) URL.revokeObjectURL(vista);
    };
  }, [vista]);

  function elegir(archivo: File | undefined) {
    if (!archivo || !archivo.type.startsWith("image/")) return;
    setVista(URL.createObjectURL(archivo));
    onChange(archivo);
  }

  function quitar() {
    setVista(null);
    onChange(null);
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={entrada}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={deshabilitado}
        onChange={(event) => elegir(event.target.files?.[0])}
      />
      {mostrada ? (
        <div className="cargar-imagen-vista">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
          <img src={mostrada} alt="Vista previa" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm text-[var(--mu)]">{vista ? "Imagen nueva" : "Imagen actual"}</p>
            <div className="flex flex-wrap gap-2">
              <label htmlFor={id} className="ui-boton ui-boton-secundario cargar-imagen-boton">
                Cambiar
              </label>
              {vista ? (
                <button type="button" className="ui-boton ui-boton-fantasma cargar-imagen-boton" onClick={quitar}>
                  Quitar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`cargar-imagen-zona ${arrastrando ? "cargar-imagen-zona-activa" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(event) => {
            event.preventDefault();
            setArrastrando(false);
            elegir(event.dataTransfer.files?.[0]);
          }}
        >
          <span aria-hidden="true" className="cargar-imagen-icono">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8l-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
          </span>
          <span className="font-semibold">Cargar imagen</span>
          <span className="text-xs text-[var(--mu)]">Toca o arrastra una foto · JPG, PNG o WebP</span>
        </label>
      )}
    </div>
  );
}
