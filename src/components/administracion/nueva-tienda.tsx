"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { crearTiendaAccion } from "@/app/administracion/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo } from "@/components/super/campo";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { capitalizar } from "@/lib/texto";
import { BotonAgregar } from "@/components/ui/boton-agregar";

export function NuevaTienda() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <BotonAgregar etiqueta="Crear tienda" alTocar={() => setAbierto(true)} />
      <Drawer abierto={abierto} titulo="Nueva tienda" alCerrar={() => setAbierto(false)}>
        <FormularioTienda alCerrar={() => setAbierto(false)} />
      </Drawer>
    </>
  );
}

function FormularioTienda({ alCerrar }: { alCerrar: () => void }) {
  const router = useRouter();
  const publicar = useToast();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [sucursales, setSucursales] = useState(false);
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await crearTiendaAccion({ nombre, direccion, sucursalesHabilitadas: sucursales });
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
          setNombre("");
          setDireccion("");
          setSucursales(false);
          publicar("exito", hecho.valor.valor);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <Campo id="tienda-nombre" etiqueta="Nombre">
        <input
          id="tienda-nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          value={nombre}
          onChange={(event) => setNombre(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <Campo id="tienda-direccion" etiqueta="Dirección">
        <input
          id="tienda-direccion"
          required
          minLength={4}
          maxLength={200}
          autoComplete="off"
          value={direccion}
          onChange={(event) => setDireccion(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <button
        type="button"
        role="switch"
        aria-checked={sucursales}
        disabled={loading}
        onClick={() => setSucursales((valor) => !valor)}
        className="inline-flex min-h-11 touch-manipulation items-center gap-3 text-left text-sm font-medium disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full ${sucursales ? "bg-[var(--br)]" : "bg-[var(--ln)]"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${sucursales ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </span>
        <span className="flex flex-col">
          <span>Habilitar sucursales</span>
          <span className="font-normal text-[var(--mu)]">
            {sucursales ? "Podrá abrir más sucursales." : "Solo tendrá una sucursal."}
          </span>
        </span>
      </button>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando="Creando…" />
    </form>
  );
}
