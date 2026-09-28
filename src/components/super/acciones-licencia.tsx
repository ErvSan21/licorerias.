"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  asignarLicenciaAccion,
  cambiarPlanAccion,
  extenderLicenciaAccion,
  reactivarLicenciaAccion,
  registrarPagoAccion,
  suspenderLicenciaAccion,
} from "@/app/super/actions";
import { Campo, claseCampo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { DIAS_GRACIA_DEFECTO, DIAS_PRUEBA_DEFECTO, formatoBs, hoyBolivia } from "@/lib/licencias/reglas";

type PlanOpcion = { id: string; nombre: string; precioMensual: number };

export function FormularioAsignar({ tiendaId, planes }: { tiendaId: string; planes: PlanOpcion[] }) {
  return (
    <FormularioSimple
      titulo="Asignar licencia de prueba"
      etiqueta="Asignar prueba"
      cargando="Asignando…"
      onSubmit={async (datos) => {
        const resultado = await asignarLicenciaAccion({
          tiendaId,
          planId: String(datos.get("planId") ?? ""),
          diasPrueba: String(datos.get("diasPrueba") ?? ""),
          diasGracia: String(datos.get("diasGracia") ?? ""),
        });
        if (!resultado.ok) throw new Error(resultado.error);
        return resultado.aviso ?? "Listo.";
      }}
    >
      <SelectPlan planes={planes} />
      <DiasPrueba />
    </FormularioSimple>
  );
}

export function FormularioPlan({
  tiendaId,
  planId,
  planes,
}: {
  tiendaId: string;
  planId: string;
  planes: PlanOpcion[];
}) {
  return (
    <FormularioSimple
      titulo="Cambiar plan"
      etiqueta="Guardar plan"
      cargando="Guardando…"
      onSubmit={async (datos) => {
        const resultado = await cambiarPlanAccion(tiendaId, String(datos.get("planId") ?? ""));
        if (!resultado.ok) throw new Error(resultado.error);
        return resultado.aviso ?? "Plan actualizado.";
      }}
    >
      <SelectPlan planes={planes} valor={planId} />
    </FormularioSimple>
  );
}

export function FormularioExtender({ tiendaId, vence }: { tiendaId: string; vence: string }) {
  const hoy = hoyBolivia();
  return (
    <FormularioSimple
      titulo="Extender vencimiento"
      etiqueta="Extender"
      cargando="Extendiendo…"
      onSubmit={async (datos) => {
        const resultado = await extenderLicenciaAccion(tiendaId, String(datos.get("vence") ?? ""));
        if (!resultado.ok) throw new Error(resultado.error);
        return resultado.aviso ?? "Vencimiento actualizado.";
      }}
    >
      <Campo id={`vence-${tiendaId}`} etiqueta="Vence">
        <input
          id={`vence-${tiendaId}`}
          name="vence"
          type="date"
          required
          min={hoy}
          autoComplete="off"
          defaultValue={vence > hoy ? vence : hoy}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
    </FormularioSimple>
  );
}

export function FormularioPago({ tiendaId }: { tiendaId: string }) {
  const hoy = hoyBolivia();
  return (
    <FormularioSimple
      titulo="Registrar pago"
      etiqueta="Registrar pago"
      cargando="Registrando pago…"
      onSubmit={async (datos) => {
        const resultado = await registrarPagoAccion({
          tiendaId,
          monto: String(datos.get("monto") ?? ""),
          fecha: String(datos.get("fecha") ?? ""),
          metodo: String(datos.get("metodo") ?? ""),
          referencia: String(datos.get("referencia") ?? ""),
          periodoDesde: String(datos.get("periodoDesde") ?? ""),
          periodoHasta: String(datos.get("periodoHasta") ?? ""),
        });
        if (!resultado.ok) throw new Error(resultado.error);
        return resultado.aviso ?? "Pago registrado.";
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`monto-${tiendaId}`} etiqueta="Monto (Bs)">
          <input
            id={`monto-${tiendaId}`}
            name="monto"
            inputMode="decimal"
            required
            autoComplete="off"
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id={`fecha-${tiendaId}`} etiqueta="Fecha del pago">
          <input
            id={`fecha-${tiendaId}`}
            name="fecha"
            type="date"
            required
            autoComplete="off"
            defaultValue={hoy}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id={`metodo-${tiendaId}`} etiqueta="Método">
          <select
            id={`metodo-${tiendaId}`}
            name="metodo"
            required
            autoComplete="off"
            defaultValue="transferencia"
            className={claseCampo}
          >
            <option value="transferencia">Transferencia</option>
            <option value="qr">QR</option>
          </select>
        </Campo>
        <Campo id={`referencia-${tiendaId}`} etiqueta="Referencia" ayuda="Opcional. Número de operación o comprobante.">
          <input
            id={`referencia-${tiendaId}`}
            name="referencia"
            maxLength={80}
            autoComplete="off"
            aria-describedby={`referencia-${tiendaId}-ayuda`}
            className={claseCampo}
          />
        </Campo>
        <Campo id={`desde-${tiendaId}`} etiqueta="Periodo desde">
          <input
            id={`desde-${tiendaId}`}
            name="periodoDesde"
            type="date"
            required
            autoComplete="off"
            defaultValue={hoy}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id={`hasta-${tiendaId}`} etiqueta="Periodo hasta">
          <input
            id={`hasta-${tiendaId}`}
            name="periodoHasta"
            type="date"
            required
            autoComplete="off"
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      </div>
    </FormularioSimple>
  );
}

export function SuspenderLicencia({ tiendaId }: { tiendaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const publicar = useToast();
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await suspenderLicenciaAccion(tiendaId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso ?? "Licencia suspendida.";
  });

  return (
    <div>
      <Button type="button" variant="peligro" onClick={() => setAbierto(true)}>
        Suspender
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo="Suspender licencia"
        descripcion="La tienda pública mostrará “Tienda no disponible” y el panel de la tienda quedará en solo lectura."
        etiquetaConfirmar="Suspender"
        etiquetaCargando="Suspendiendo…"
        peligro
        cargando={loading}
        error={error}
        alCerrar={() => {
          if (!loading) setAbierto(false);
        }}
        alConfirmar={() => {
          void run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setAbierto(false);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

export function ReactivarLicencia({ tiendaId }: { tiendaId: string }) {
  const router = useRouter();
  const publicar = useToast();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const resultado = await reactivarLicenciaAccion(tiendaId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso ?? "Licencia reactivada.";
  });

  return (
    <Button
      type="button"
      variant="secundario"
      loading={loading}
      loadingLabel="Reactivando…"
      success={success}
      error={error ?? false}
      onClick={() => {
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      Reactivar
    </Button>
  );
}

function FormularioSimple({
  titulo,
  etiqueta,
  cargando,
  onSubmit,
  children,
}: {
  titulo: string;
  etiqueta: string;
  cargando: string;
  onSubmit: (datos: FormData) => Promise<string>;
  children: React.ReactNode;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const salida = useAvisoSalida();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    return onSubmit(datos);
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      <h3 className="text-base font-semibold">{titulo}</h3>
      {children}
      <Button type="submit" loading={loading} loadingLabel={cargando} success={success} error={error ?? false}>
        {etiqueta}
      </Button>
    </form>
  );
}

function SelectPlan({ planes, valor }: { planes: PlanOpcion[]; valor?: string }) {
  return (
    <Campo id={valor ? `plan-${valor}` : "plan-nuevo"} etiqueta="Plan">
      <select
        id={valor ? `plan-${valor}` : "plan-nuevo"}
        name="planId"
        required
        autoComplete="off"
        defaultValue={valor ?? ""}
        className={claseCampo}
      >
        {valor ? null : (
          <option value="" disabled>
            Elige un plan
          </option>
        )}
        {planes.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.nombre} · {formatoBs(plan.precioMensual)} / mes
          </option>
        ))}
      </select>
    </Campo>
  );
}

function DiasPrueba() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="dias-prueba-asignar" etiqueta="Días de prueba">
        <input
          id="dias-prueba-asignar"
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
      <Campo id="dias-gracia-asignar" etiqueta="Días de gracia">
        <input
          id="dias-gracia-asignar"
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
  );
}
