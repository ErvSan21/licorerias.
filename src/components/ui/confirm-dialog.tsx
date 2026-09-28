"use client";

import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";

export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  etiquetaConfirmar = "Confirmar",
  etiquetaCancelar = "Cancelar",
  etiquetaCargando = "Guardando…",
  peligro = false,
  cargando = false,
  error = null,
  alCerrar,
  alConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar?: string;
  etiquetaCancelar?: string;
  etiquetaCargando?: string;
  peligro?: boolean;
  cargando?: boolean;
  error?: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={titulo}
      descripcion={descripcion}
      alCerrar={alCerrar}
      bloquearCierre={cargando}
      alineacion="centro"
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secundario"
          data-autofocus={peligro ? true : undefined}
          disabled={cargando}
          onClick={alCerrar}
        >
          {etiquetaCancelar}
        </Button>
        <Button
          type="button"
          variant={peligro ? "peligro" : "primario"}
          data-autofocus={peligro ? undefined : true}
          loading={cargando}
          loadingLabel={etiquetaCargando}
          error={error ?? false}
          onClick={alConfirmar}
        >
          {etiquetaConfirmar}
        </Button>
      </div>
    </Dialogo>
  );
}
