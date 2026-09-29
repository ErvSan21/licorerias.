"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { eliminarPlanAccion, guardarPlanAccion } from "@/app/administracion/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo } from "@/components/super/campo";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { PLAZOS, esPlazo, etiquetaPlazo, formatoBs, type Plazo } from "@/lib/licencias/reglas";

type PlanFila = {
  clave: string;
  nombre: string;
  precio: number;
};

type AccionPlan = "editar" | "eliminar";

export function PlanesPanel({ planes }: { planes: PlanFila[] }) {
  const ocupadas = planes.flatMap((plan) => (esPlazo(plan.clave) ? [plan.clave] : []));

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Planes</h2>
      {planes.length === 0 ? (
        <EmptyState titulo="No hay planes" descripcion="Los precios de suscripción aparecen aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {planes.map((plan) => (
            <li key={plan.clave}>
              <TarjetaPlan plan={plan} ocupadas={ocupadas} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function TarjetaPlan({ plan, ocupadas }: { plan: PlanFila; ocupadas: Plazo[] }) {
  const router = useRouter();
  const publicar = useToast();
  const [lista, setLista] = useState(false);
  const [accion, setAccion] = useState<AccionPlan | null>(null);
  const plazo = esPlazo(plan.clave) ? plan.clave : null;

  function cerrar() {
    setLista(false);
    setAccion(null);
  }

  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-semibold">{plan.nombre}</p>
        <p className="text-sm text-[var(--mu)]">
          {plazo ? etiquetaPlazo(plazo) : plan.clave} · {formatoBs(plan.precio)}
        </p>
        {plazo === "demo" ? <p className="text-sm text-[var(--mu)]">Sin fecha de fin</p> : null}
      </div>
      <button
        type="button"
        className="boton-icono"
        aria-label={`Acciones de ${plan.nombre}`}
        aria-haspopup="dialog"
        onClick={() => setLista(true)}
      >
        <span aria-hidden>⋮</span>
      </button>
      <Drawer abierto={lista} titulo={plan.nombre} alCerrar={() => setLista(false)}>
        <ul className="flex flex-col">
          <li>
            <button type="button" className="menu-hoja-item" onClick={() => { setLista(false); setAccion("editar"); }}>
              Editar
            </button>
          </li>
          <li>
            <button
              type="button"
              className="menu-hoja-item menu-hoja-item-peligro"
              onClick={() => { setLista(false); setAccion("eliminar"); }}
            >
              Eliminar
            </button>
          </li>
        </ul>
      </Drawer>
      <Drawer abierto={accion === "editar"} titulo="Editar plan" alCerrar={cerrar}>
        {plazo ? (
          <FormularioPlan
            plan={plan}
            plazo={plazo}
            ocupadas={ocupadas}
            alCerrar={cerrar}
            alListo={(aviso) => {
              publicar("exito", aviso);
              cerrar();
              router.refresh();
            }}
          />
        ) : null}
      </Drawer>
      <Drawer
        abierto={accion === "eliminar"}
        titulo="Eliminar plan"
        descripcion="Se quita este precio. Las tiendas que ya tienen este plan no cambian."
        alCerrar={cerrar}
      >
        <ConfirmarEliminar
          clave={plan.clave}
          alCerrar={cerrar}
          alListo={(aviso) => {
            publicar("exito", aviso);
            cerrar();
            router.refresh();
          }}
        />
      </Drawer>
    </Card>
  );
}

function FormularioPlan({
  plan,
  plazo,
  ocupadas,
  alCerrar,
  alListo,
}: {
  plan: PlanFila;
  plazo: Plazo;
  ocupadas: Plazo[];
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const [nombre, setNombre] = useState(plan.nombre);
  const [duracion, setDuracion] = useState<Plazo>(plazo);
  const [costo, setCosto] = useState(textoPrecio(plan.precio));
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await guardarPlanAccion({
      claveActual: plan.clave,
      nombre,
      duracion,
      costo,
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alListo(hecho.valor.valor);
        });
      }}
    >
      <Campo id={`plan-nombre-${plan.clave}`} etiqueta="Nombre">
        <input
          id={`plan-nombre-${plan.clave}`}
          required
          maxLength={40}
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`plan-duracion-${plan.clave}`} etiqueta="Duración">
        <select
          id={`plan-duracion-${plan.clave}`}
          required
          value={duracion}
          onChange={(event) => {
            if (esPlazo(event.target.value)) setDuracion(event.target.value);
          }}
          className={claseCampo}
        >
          {PLAZOS.map((opcion) => (
            <option key={opcion} value={opcion} disabled={opcion !== plazo && ocupadas.includes(opcion)}>
              {etiquetaPlazo(opcion)}
            </option>
          ))}
        </select>
      </Campo>
      {duracion === "demo" ? <p className="text-sm text-[var(--mu)]">Sin fecha de fin.</p> : null}
      <Campo id={`plan-costo-${plan.clave}`} etiqueta="Costo">
        <input
          id={`plan-costo-${plan.clave}`}
          required
          inputMode="decimal"
          value={costo}
          onChange={(event) => setCosto(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} />
    </form>
  );
}

function ConfirmarEliminar({
  clave,
  alCerrar,
  alListo,
}: {
  clave: string;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await eliminarPlanAccion(clave);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alListo(hecho.valor.valor);
        });
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja peligro alCancelar={alCerrar} cargando={loading} etiquetaCargando="Eliminando…" />
    </form>
  );
}

function textoPrecio(precio: number): string {
  if (!Number.isFinite(precio)) return "";
  return Number.isInteger(precio) ? String(precio) : precio.toFixed(2);
}
