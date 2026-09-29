"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarCatalogoCentralAccion } from "@/app/t/[slug]/actions";
import { guardarConfiguracionPreciosAccion } from "@/app/t/[slug]/productos/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Interruptor "Mismos precios de la central".
 * Activado: las sucursales no pueden cambiar precios (usan el central).
 * Desactivado: cada sucursal puede fijar su precio.
 */
export function InterruptorPreciosCentral({
  slug,
  lectura,
  permiten,
  margen,
}: {
  slug: string;
  lectura: boolean;
  permiten: boolean;
  margen: number | null;
}) {
  const router = useRouter();
  const publicar = useToast();
  const mismos = !permiten;
  const [cargando, setCargando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function guardar(activarMismos: boolean) {
    const datos = new FormData();
    datos.set("permiten", activarMismos ? "off" : "on");
    datos.set("margen", margen == null ? "" : String(margen));
    setCargando(true);
    setError(null);
    void guardarConfiguracionPreciosAccion(slug, datos).then((resultado) => {
      setCargando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setConfirmar(false);
      publicar("exito", resultado.aviso);
      router.refresh();
    });
  }

  return (
    <>
      <Interruptor
        titulo="Mismos precios de la central"
        descripcion={
          mismos
            ? "Todas las sucursales venden al precio de la central y no pueden cambiarlo."
            : "Cada sucursal puede fijar su propio precio en Precios por sucursal."
        }
        activo={mismos}
        deshabilitado={lectura || cargando}
        alCambiar={() => {
          // Activar reemplaza los precios propios: se confirma.
          if (!mismos) setConfirmar(true);
          else guardar(false);
        }}
      />
      {error && !confirmar ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        abierto={confirmar}
        titulo="Usar los precios de la central"
        descripcion="Los precios propios de las sucursales se reemplazan por el central. El cambio queda en el historial."
        etiquetaConfirmar="Usar precio central"
        cargando={cargando}
        error={error}
        alCerrar={() => {
          if (!cargando) setConfirmar(false);
        }}
        alConfirmar={() => guardar(true)}
      />
    </>
  );
}

/** Interruptor "Productos de la central en las sucursales" (siempre sincronizado). */
export function InterruptorCatalogoCentral({
  slug,
  lectura,
  activo,
}: {
  slug: string;
  lectura: boolean;
  activo: boolean;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Interruptor
        titulo="Productos de la central en las sucursales"
        descripcion={
          activo
            ? "Todas las sucursales muestran los productos y categorías de la central. Sin stock se ven como Agotado."
            : "Cada sucursal elige qué productos ofrece."
        }
        activo={activo}
        deshabilitado={lectura || cargando}
        alCambiar={() => {
          setCargando(true);
          setError(null);
          void guardarCatalogoCentralAccion(slug, !activo).then((resultado) => {
            setCargando(false);
            if (!resultado.ok) {
              setError(resultado.error);
              return;
            }
            publicar("exito", resultado.aviso);
            router.refresh();
          });
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Fila con título, descripción y un interruptor a la derecha. */
export function Interruptor({
  titulo,
  descripcion,
  activo,
  deshabilitado,
  alCambiar,
}: {
  titulo: string;
  descripcion: string;
  activo: boolean;
  deshabilitado: boolean;
  alCambiar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={alCambiar}
      className="ajuste-interruptor"
    >
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-sm text-[var(--mu)]">{descripcion}</span>
      </span>
      <span aria-hidden="true" className={`ajuste-pista ${activo ? "ajuste-pista-activa" : ""}`}>
        <span className="ajuste-perilla" />
      </span>
    </button>
  );
}
