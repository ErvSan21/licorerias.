"use client";

import { Button } from "@/components/ui/button";

export function PieHoja({
  alGuardar,
  alCancelar,
  cargando = false,
  etiquetaCargando = "Guardando…",
  form,
  peligro = false,
  deshabilitado = false,
}: {
  alGuardar?: () => void;
  alCancelar: () => void;
  cargando?: boolean;
  etiquetaCargando?: string;
  form?: string;
  peligro?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Button
        type={alGuardar ? "button" : "submit"}
        form={form}
        variant={peligro ? "peligro" : "primario"}
        className="flex-1"
        loading={cargando}
        loadingLabel={etiquetaCargando}
        disabled={deshabilitado}
        onClick={alGuardar}
      >
        Guardar
      </Button>
      <Button type="button" variant="secundario" className="flex-1" onClick={alCancelar} disabled={cargando}>
        Cancelar
      </Button>
    </div>
  );
}
