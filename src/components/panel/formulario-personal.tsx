"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { guardarPersonalAccion, invitarPersonalAccion } from "@/app/t/[slug]/actions";
import { useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import type { RolTienda } from "@/lib/tenant";

const claseCampo =
  "h-12 w-full rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 text-base text-[var(--campo-tx)]";

type SucursalOpcion = { id: string; nombre: string };

export function FormularioInvitar({
  slug,
  sucursales,
  lectura,
}: {
  slug: string;
  sucursales: SucursalOpcion[];
  lectura: boolean;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const salida = useAvisoSalida();
  const [rol, setRol] = useState<RolTienda>("vendedor");
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    const resultado = await invitarPersonalAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura || !event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          formulario.current?.reset();
          setRol("vendedor");
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      <h2 className="text-lg font-semibold">Invitar</h2>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="correo-personal">
        Correo
        <input
          id="correo-personal"
          name="correo"
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          disabled={lectura}
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="rol-personal">
        Rol
        <select
          id="rol-personal"
          name="rol"
          required
          autoComplete="off"
          value={rol}
          disabled={lectura}
          onChange={(event) => setRol(event.target.value as RolTienda)}
          className={claseCampo}
        >
          <option value="dueno">Dueño</option>
          <option value="gerente">Gerente</option>
          <option value="vendedor">Vendedor</option>
        </select>
      </label>
      {rol === "dueno" ? (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Un dueño entra a todas las sucursales.</p>
      ) : (
        <fieldset className="flex flex-col gap-1" disabled={lectura}>
          <legend className="text-sm font-medium">Sucursales</legend>
          {sucursales.map((sucursal) => (
            <label key={sucursal.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="sucursalId" value={sucursal.id} />
              {sucursal.nombre}
            </label>
          ))}
        </fieldset>
      )}
      <Button type="submit" disabled={lectura} loading={loading} loadingLabel="Invitando…" success={success} error={error ?? false}>
        Invitar
      </Button>
    </form>
  );
}

export function FormularioPersona({
  slug,
  lectura,
  persona,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  persona: { id: string; rol: RolTienda; activo: boolean; correo: string | null; sucursalIds: string[] };
  sucursales: SucursalOpcion[];
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const [rol, setRol] = useState<RolTienda>(persona.rol);
  const [confirmar, setConfirmar] = useState(false);
  const salida = useAvisoSalida();
  const guardar = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    const resultado = await guardarPersonalAccion(slug, persona.id, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const desactivar = useAsyncAction(async () => {
    const datos = new FormData();
    datos.set("rol", persona.rol);
    datos.set("activo", "off");
    for (const id of persona.sucursalIds) datos.append("sucursalId", id);
    const resultado = await guardarPersonalAccion(slug, persona.id, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        void guardar.run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          publicar("exito", hecho.valor.valor);
          router.refresh();
        });
      }}
    >
      <p className="break-words text-sm font-medium">{persona.correo ?? "Sin correo"}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor={`rol-${persona.id}`}>
        Rol
        <select
          id={`rol-${persona.id}`}
          name="rol"
          autoComplete="off"
          value={rol}
          disabled={lectura}
          onChange={(event) => setRol(event.target.value as RolTienda)}
          className={claseCampo}
        >
          <option value="dueno">Dueño</option>
          <option value="gerente">Gerente</option>
          <option value="vendedor">Vendedor</option>
        </select>
      </label>
      {rol === "dueno" ? null : (
        <fieldset className="flex flex-col gap-1" disabled={lectura}>
          <legend className="text-sm font-medium">Sucursales</legend>
          {sucursales.map((sucursal) => (
            <label key={sucursal.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="sucursalId"
                value={sucursal.id}
                defaultChecked={persona.sucursalIds.includes(sucursal.id)}
              />
              {sucursal.nombre}
            </label>
          ))}
        </fieldset>
      )}
      <input type="hidden" name="activo" value="on" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{persona.activo ? "Activo" : "Inactivo"}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={lectura}
          loading={guardar.loading}
          loadingLabel="Guardando…"
          success={guardar.success}
          error={guardar.error ?? false}
        >
          Guardar
        </Button>
        {persona.activo ? (
          <Button type="button" variant="peligro" disabled={lectura} onClick={() => setConfirmar(true)}>
            Desactivar
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        abierto={confirmar}
        titulo="Desactivar persona"
        descripcion="Pierde el acceso a esta tienda. Puedes volver a invitarla si el plan tiene cupo."
        etiquetaConfirmar="Desactivar"
        etiquetaCargando="Desactivando…"
        peligro
        cargando={desactivar.loading}
        error={desactivar.error}
        alCerrar={() => {
          if (!desactivar.loading) setConfirmar(false);
        }}
        alConfirmar={() => {
          void desactivar.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setConfirmar(false);
            router.refresh();
          });
        }}
      />
    </form>
  );
}
