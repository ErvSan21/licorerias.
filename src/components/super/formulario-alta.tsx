"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { crearTiendaAccion } from "@/app/super/actions";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { useToast } from "@/components/ui/toast";
import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { DIAS_GRACIA_DEFECTO, DIAS_PRUEBA_DEFECTO, formatoBs } from "@/lib/licencias/reglas";

type PlanOpcion = { id: string; nombre: string; precioMensual: number };

export function FormularioAlta({ planes }: { planes: PlanOpcion[] }) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const salida = useAvisoSalida();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    const resultado = await crearTiendaAccion({
      nombre: String(datos.get("nombre") ?? ""),
      slug: String(datos.get("slug") ?? ""),
      planId: String(datos.get("planId") ?? ""),
      correoDueno: String(datos.get("correoDueno") ?? ""),
      diasPrueba: String(datos.get("diasPrueba") ?? ""),
      diasGracia: String(datos.get("diasGracia") ?? ""),
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          publicar("exito", hecho.valor.valor.aviso ?? "Tienda creada.");
          if (hecho.valor.valor.id) router.push(`/super/tiendas/${hecho.valor.valor.id}`);
        });
      }}
    >
      <Campo id="nombre" etiqueta="Nombre de la tienda">
        <input
          id="nombre"
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="organization"
          className={claseCampo}
        />
      </Campo>
      <Campo
        id="slug"
        etiqueta="Identificador"
        ayuda="Minúsculas, números y guiones. Forma la dirección /t/identificador."
      >
        <input
          id="slug"
          name="slug"
          required
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          translate="no"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          aria-describedby="slug-ayuda"
          className={claseCampo}
        />
      </Campo>
      <Campo id="planId" etiqueta="Plan">
        <select id="planId" name="planId" required autoComplete="off" className={claseCampo} defaultValue="">
          <option value="" disabled>
            Elige un plan
          </option>
          {planes.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.nombre} · {formatoBs(plan.precioMensual)} / mes
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="correoDueno" etiqueta="Correo del dueño" ayuda="Le enviaremos una invitación para crear su contraseña.">
        <input
          id="correoDueno"
          name="correoDueno"
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          aria-describedby="correoDueno-ayuda"
          className={claseCampo}
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="diasPrueba" etiqueta="Días de prueba">
          <input
            id="diasPrueba"
            name="diasPrueba"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={90}
            autoComplete="off"
            defaultValue={DIAS_PRUEBA_DEFECTO}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id="diasGracia" etiqueta="Días de gracia">
          <input
            id="diasGracia"
            name="diasGracia"
            type="number"
            inputMode="numeric"
            required
            min={0}
            max={30}
            autoComplete="off"
            defaultValue={DIAS_GRACIA_DEFECTO}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      </div>
      <Button type="submit" loading={loading} loadingLabel="Creando tienda…" success={success} error={error ?? false}>
        Crear tienda
      </Button>
    </form>
  );
}
