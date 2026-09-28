"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarPreciosAccion } from "@/app/administracion/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import type { PreciosSuscripcion } from "@/lib/administracion/reglas";

export function FormularioPrecios({ precios }: { precios: PreciosSuscripcion }) {
  const router = useRouter();
  const publicar = useToast();
  const [mes, setMes] = useState(texto(precios.mes));
  const [tresMeses, setTresMeses] = useState(texto(precios.tres_meses));
  const [anio, setAnio] = useState(texto(precios.anio));
  const { run, loading, error, success } = useAsyncAction(async () => {
    const resultado = await guardarPreciosAccion({ mes, tresMeses, anio });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      <h2 className="text-lg font-semibold">Precios de los planes</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="precio-mes" etiqueta="1 mes">
          <input
            id="precio-mes"
            inputMode="decimal"
            required
            autoComplete="off"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id="precio-tres" etiqueta="3 meses">
          <input
            id="precio-tres"
            inputMode="decimal"
            required
            autoComplete="off"
            value={tresMeses}
            onChange={(event) => setTresMeses(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id="precio-anio" etiqueta="1 año">
          <input
            id="precio-anio"
            inputMode="decimal"
            required
            autoComplete="off"
            value={anio}
            onChange={(event) => setAnio(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={loading} loadingLabel="Guardando…" success={success} className="sm:w-fit">
        Guardar precios
      </Button>
    </form>
  );
}

function texto(monto: number): string {
  return Number.isInteger(monto) ? String(monto) : monto.toFixed(2);
}
