"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { crearSucursalAccion, desactivarSucursalAccion, guardarSucursalAccion } from "@/app/t/[slug]/actions";
import { MapaPin } from "@/components/panel/mapa-pin";
import { useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { DIAS, ETIQUETA_DIA, type Horario } from "@/lib/sucursales/reglas";

const claseCampo =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

type SucursalFormulario = {
  id: string;
  nombre: string;
  slug: string;
  direccion: string;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  horario: Horario;
  abierta: boolean;
  minutosAnticipacionRecojo: number;
  aceptaDelivery: boolean;
  aceptaRecojo: boolean;
  activa: boolean;
};

export function FormularioNuevaSucursal({ slug, lectura }: { slug: string; lectura: boolean }) {
  return (
    <FormularioSucursal
      slug={slug}
      lectura={lectura}
      sucursal={null}
      onSubmit={(datos) => crearSucursalAccion(slug, datos)}
    />
  );
}

export function FormularioEditarSucursal({
  slug,
  lectura,
  sucursal,
}: {
  slug: string;
  lectura: boolean;
  sucursal: SucursalFormulario;
}) {
  return (
    <FormularioSucursal
      slug={slug}
      lectura={lectura}
      sucursal={sucursal}
      onSubmit={(datos) => guardarSucursalAccion(slug, sucursal.id, datos)}
    />
  );
}

function FormularioSucursal({
  slug,
  lectura,
  sucursal,
  onSubmit,
}: {
  slug: string;
  lectura: boolean;
  sucursal: SucursalFormulario | null;
  onSubmit: (datos: FormData) => Promise<{ ok: true; aviso: string; id?: string } | { ok: false; error: string }>;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const publicar = useToast();
  const salida = useAvisoSalida();
  const [lat, setLat] = useState(sucursal?.lat?.toString() ?? "");
  const [lng, setLng] = useState(sucursal?.lng?.toString() ?? "");
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(formulario.current ?? undefined);
    const resultado = await onSubmit(datos);
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
        if (lectura) return;
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          salida.limpiar();
          publicar("exito", hecho.valor.valor.aviso);
          if (!sucursal && hecho.valor.valor.id) {
            router.push(`/t/${slug}/sucursales/${hecho.valor.valor.id}`);
          } else {
            router.refresh();
          }
        });
      }}
    >
      <Campo id="nombre-sucursal" etiqueta="Nombre">
        <input
          id="nombre-sucursal"
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="organization"
          defaultValue={sucursal?.nombre ?? ""}
          disabled={lectura}
          className={claseCampo}
        />
      </Campo>
      <Campo id="slug-sucursal" etiqueta="Identificador" ayuda="Minúsculas, números y guiones. Único dentro de la tienda.">
        <input
          id="slug-sucursal"
          name="slug"
          required
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          translate="no"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          aria-describedby="slug-sucursal-ayuda"
          defaultValue={sucursal?.slug ?? ""}
          disabled={lectura}
          className={claseCampo}
        />
      </Campo>
      <Campo id="direccion-sucursal" etiqueta="Dirección">
        <input
          id="direccion-sucursal"
          name="direccion"
          maxLength={160}
          autoComplete="street-address"
          defaultValue={sucursal?.direccion ?? ""}
          disabled={lectura}
          className={claseCampo}
        />
      </Campo>
      <Campo id="telefono-sucursal" etiqueta="Teléfono" ayuda="8 dígitos de Bolivia. Se guarda con 591.">
        <input
          id="telefono-sucursal"
          name="telefono"
          inputMode="tel"
          autoComplete="tel"
          aria-describedby="telefono-sucursal-ayuda"
          defaultValue={sucursal?.telefono?.startsWith("591") ? sucursal.telefono.slice(3) : (sucursal?.telefono ?? "")}
          disabled={lectura}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <MapaPin
        lat={numero(lat)}
        lng={numero(lng)}
        onMove={(siguienteLat, siguienteLng) => {
          setLat(String(siguienteLat));
          setLng(String(siguienteLng));
          salida.marcarSucio();
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="lat-sucursal" etiqueta="Latitud">
          <input
            id="lat-sucursal"
            name="lat"
            inputMode="decimal"
            autoComplete="off"
            value={lat}
            disabled={lectura}
            onChange={(event) => setLat(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        <Campo id="lng-sucursal" etiqueta="Longitud">
          <input
            id="lng-sucursal"
            name="lng"
            inputMode="decimal"
            autoComplete="off"
            value={lng}
            disabled={lectura}
            onChange={(event) => setLng(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      </div>
      <fieldset className="flex flex-col gap-3" disabled={lectura}>
        <legend className="text-sm font-medium">Horario</legend>
        {(sucursal?.horario ? DIAS.map((dia) => [dia, sucursal.horario[dia]] as const) : DIAS.map((dia) => [dia, null] as const)).map(
          ([dia, franja]) => (
            <div key={dia} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`abierto-${dia}`}
                  defaultChecked={franja ? franja.abierto : dia !== "dom"}
                />
                {ETIQUETA_DIA[dia]}
              </label>
              <input
                aria-label={`${ETIQUETA_DIA[dia]} abre`}
                name={`desde-${dia}`}
                type="time"
                autoComplete="off"
                required
                defaultValue={franja?.desde ?? "09:00"}
                className={`${claseCampo} tabular-nums`}
              />
              <input
                aria-label={`${ETIQUETA_DIA[dia]} cierra`}
                name={`hasta-${dia}`}
                type="time"
                autoComplete="off"
                required
                defaultValue={franja?.hasta ?? "21:00"}
                className={`${claseCampo} tabular-nums`}
              />
            </div>
          ),
        )}
      </fieldset>
      <Campo id="minutos-sucursal" etiqueta="Minutos de anticipación para recojo">
        <input
          id="minutos-sucursal"
          name="minutos"
          type="number"
          inputMode="numeric"
          min={0}
          max={240}
          autoComplete="off"
          required
          defaultValue={sucursal?.minutosAnticipacionRecojo ?? 30}
          disabled={lectura}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <div className="flex flex-col gap-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="aceptaDelivery" defaultChecked={sucursal?.aceptaDelivery ?? false} disabled={lectura} />
          Acepta delivery
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="aceptaRecojo" defaultChecked={sucursal?.aceptaRecojo ?? true} disabled={lectura} />
          Acepta recojo
        </label>
        {sucursal ? (
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="activa" defaultChecked={sucursal.activa} disabled={lectura} />
            Sucursal activa
          </label>
        ) : null}
      </div>
      <Button type="submit" disabled={lectura} loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
        {sucursal ? "Guardar sucursal" : "Crear sucursal"}
      </Button>
    </form>
  );
}

export function DesactivarSucursal({ slug, sucursalId }: { slug: string; sucursalId: string }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const publicar = useToast();
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await desactivarSucursalAccion(slug, sucursalId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <div>
      <Button type="button" variant="peligro" onClick={() => setAbierto(true)}>
        Desactivar
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo="Desactivar sucursal"
        descripcion="Deja de contar para el plan y queda cerrada. Puedes volver a activarla editando la sucursal, si el plan tiene cupo."
        etiquetaConfirmar="Desactivar"
        etiquetaCargando="Desactivando…"
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

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

function numero(valor: string): number | null {
  if (!valor.trim()) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}
