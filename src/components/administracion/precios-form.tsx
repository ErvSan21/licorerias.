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
  const [mensual, setMensual] = useState(texto(precios.mensual));
  const [trimestral, setTrimestral] = useState(texto(precios.trimestral));
  const [anual, setAnual] = useState(texto(precios.anual));
  const [demo, setDemo] = useState(texto(precios.demo));
  const { run, loading, error, success } = useAsyncAction(async () => {
    const resultado = await guardarPreciosAccion({ mensual, trimestral, anual, demo });
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
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoPrecio id="precio-mensual" etiqueta="Mensual" valor={mensual} alCambiar={setMensual} />
        <CampoPrecio id="precio-trimestral" etiqueta="Trimestral" valor={trimestral} alCambiar={setTrimestral} />
        <CampoPrecio id="precio-anual" etiqueta="Anual" valor={anual} alCambiar={setAnual} />
        <CampoPrecio id="precio-demo" etiqueta="Demo" valor={demo} alCambiar={setDemo} />
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

function CampoPrecio({
  id,
  etiqueta,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <Campo id={id} etiqueta={etiqueta}>
      <input
        id={id}
        inputMode="decimal"
        required
        autoComplete="off"
        value={valor}
        onChange={(event) => alCambiar(event.target.value)}
        className={`${claseCampo} tabular-nums`}
      />
    </Campo>
  );
}

function texto(monto: number): string {
  return Number.isInteger(monto) ? String(monto) : monto.toFixed(2);
}
