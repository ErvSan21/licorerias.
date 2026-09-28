"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  ajustarCentralAccion,
  ajustarPropiosAccion,
  copiarPreciosAccion,
  guardarConfiguracionPreciosAccion,
  volverPreciosCentralesAccion,
} from "@/app/t/[slug]/productos/actions";
import { Campo, useAvisoSalida } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { CategoriaLista, SucursalCatalogo } from "@/lib/catalogo/tipos";

const claseCampo =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function ConfiguracionPrecios({
  slug,
  lectura,
  permiten,
  margen,
}: {
  slug: string;
  lectura: boolean;
  permiten: boolean;
  margen: number | null;
}) {
  const [activo, setActivo] = useState(permiten);
  const [base, setBase] = useState(permiten);
  const [confirmar, setConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const publicar = useToast();
  const router = useRouter();
  const salida = useAvisoSalida();

  if (permiten !== base) {
    setBase(permiten);
    setActivo(permiten);
  }

  function enviar(datos: FormData) {
    setCargando(true);
    setError(null);
    void guardarConfiguracionPreciosAccion(slug, datos).then((resultado) => {
      setCargando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        publicar("error", resultado.error);
        return;
      }
      setConfirmar(false);
      salida.limpiar();
      publicar("exito", resultado.aviso);
      router.refresh();
    });
  }

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        if (!event.currentTarget.reportValidity()) return;
        const datos = new FormData(event.currentTarget);
        if (!activo && permiten) {
          setConfirmar(true);
          return;
        }
        enviar(datos);
      }}
    >
      <h3 className="text-base font-semibold">Precios de las sucursales</h3>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={lectura || cargando}
        onClick={() => {
          salida.marcarSucio();
          setActivo((valor) => !valor);
        }}
        className="inline-flex min-h-11 touch-manipulation items-center gap-3 text-left text-sm font-medium disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full ${activo ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform motion-reduce:transition-none dark:bg-zinc-950 ${activo ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </span>
        {activo ? "Las sucursales pueden fijar su precio" : "Solo precio central"}
      </button>
      <input type="hidden" name="permiten" value={activo ? "on" : "off"} />
      <Campo id="margen-maximo" etiqueta="Margen máximo" ayuda="Opcional. Porcentaje sobre el precio central. Vacío quiere decir sin tope.">
        <input
          id="margen-maximo"
          name="margen"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          min={0}
          step="0.01"
          defaultValue={margen ?? ""}
          aria-describedby="margen-maximo-ayuda"
          disabled={lectura || !activo}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={cargando} disabled={lectura} error={Boolean(error)}>
        Guardar regla
      </Button>
      <ConfirmDialog
        abierto={confirmar}
        titulo="Volver todas las sucursales al precio central"
        descripcion="Los precios propios se reemplazan por el central y quedan en el historial."
        etiquetaConfirmar="Bloquear precios propios"
        peligro
        cargando={cargando}
        error={error}
        alCerrar={() => {
          if (!cargando) setConfirmar(false);
        }}
        alConfirmar={() => {
          if (!formulario.current) return;
          enviar(new FormData(formulario.current));
        }}
      />
    </form>
  );
}

export function AccionesMasivasPrecio({
  slug,
  lectura,
  sucursales,
  categorias,
}: {
  slug: string;
  lectura: boolean;
  sucursales: SucursalCatalogo[];
  categorias: CategoriaLista[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <VolverCentral slug={slug} lectura={lectura} sucursales={sucursales} />
      <AjusteCentral slug={slug} lectura={lectura} categorias={categorias} />
      <AjustePropio slug={slug} lectura={lectura} sucursales={sucursales} />
      <CopiarPropios slug={slug} lectura={lectura} sucursales={sucursales} />
    </div>
  );
}

function VolverCentral({
  slug,
  lectura,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  sucursales: SucursalCatalogo[];
}) {
  return (
    <AccionConfirmada
      titulo="Volver todos los productos a precio central"
      descripcion="En la sucursal elegida, cada precio propio pasa al central. Queda en el historial."
      etiqueta="Volver al central"
      lectura={lectura}
      alConfirmar={(datos) => volverPreciosCentralesAccion(slug, String(datos.get("sucursalId") ?? ""))}
    >
      <SelectSucursal id="volver-sucursal" sucursales={sucursales} />
    </AccionConfirmada>
  );
}

function AjusteCentral({
  slug,
  lectura,
  categorias,
}: {
  slug: string;
  lectura: boolean;
  categorias: CategoriaLista[];
}) {
  const activas = categorias.filter((categoria) => categoria.activa);
  return (
    <AccionConfirmada
      titulo="Ajuste porcentual del precio central por categoría"
      descripcion="Sube o baja el precio central de esa categoría. Usa un porcentaje negativo para bajarlo."
      etiqueta="Ajustar precio central"
      lectura={lectura || activas.length === 0}
      alConfirmar={(datos) =>
        ajustarCentralAccion(slug, String(datos.get("categoriaId") ?? ""), String(datos.get("porcentaje") ?? ""))
      }
    >
      <Campo id="ajuste-categoria" etiqueta="Categoría">
        <select id="ajuste-categoria" name="categoriaId" required disabled={activas.length === 0} className={claseCampo}>
          {activas.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <CampoPorcentaje id="ajuste-central-porcentaje" />
    </AccionConfirmada>
  );
}

function AjustePropio({
  slug,
  lectura,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  sucursales: SucursalCatalogo[];
}) {
  return (
    <AccionConfirmada
      titulo="Ajuste porcentual de precios propios"
      descripcion="Solo cambia los productos que ya tienen precio propio en esa sucursal."
      etiqueta="Ajustar precios propios"
      lectura={lectura}
      alConfirmar={(datos) =>
        ajustarPropiosAccion(slug, String(datos.get("sucursalId") ?? ""), String(datos.get("porcentaje") ?? ""))
      }
    >
      <SelectSucursal id="ajuste-propio-sucursal" sucursales={sucursales} />
      <CampoPorcentaje id="ajuste-propio-porcentaje" />
    </AccionConfirmada>
  );
}

function CopiarPropios({
  slug,
  lectura,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  sucursales: SucursalCatalogo[];
}) {
  return (
    <AccionConfirmada
      titulo="Copiar precios propios de otra sucursal"
      descripcion="Copia solo los precios propios, y solo en productos que ya se ofrecen en el destino."
      etiqueta="Copiar precios"
      lectura={lectura || sucursales.length < 2}
      alConfirmar={(datos) =>
        copiarPreciosAccion(slug, String(datos.get("origenId") ?? ""), String(datos.get("destinoId") ?? ""))
      }
    >
      <Campo id="copiar-origen" etiqueta="Desde">
        <select id="copiar-origen" name="origenId" required className={claseCampo}>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="copiar-destino" etiqueta="Hacia">
        <select id="copiar-destino" name="destinoId" required className={claseCampo}>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
    </AccionConfirmada>
  );
}

function SelectSucursal({ id, sucursales }: { id: string; sucursales: SucursalCatalogo[] }) {
  return (
    <Campo id={id} etiqueta="Sucursal">
      <select id={id} name="sucursalId" required className={claseCampo}>
        {sucursales.map((sucursal) => (
          <option key={sucursal.id} value={sucursal.id}>
            {sucursal.nombre}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function CampoPorcentaje({ id }: { id: string }) {
  return (
    <Campo id={id} etiqueta="Porcentaje" ayuda="Entre -100 y 1000. Por ejemplo, 10 sube y -10 baja.">
      <input
        id={id}
        name="porcentaje"
        required
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-ayuda`}
        className={`${claseCampo} tabular-nums`}
      />
    </Campo>
  );
}

function AccionConfirmada({
  titulo,
  descripcion,
  etiqueta,
  lectura,
  alConfirmar,
  children,
}: {
  titulo: string;
  descripcion: string;
  etiqueta: string;
  lectura: boolean;
  alConfirmar: (datos: FormData) => Promise<{ ok: true; aviso: string } | { ok: false; error: string }>;
  children: React.ReactNode;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicar = useToast();
  const router = useRouter();
  const salida = useAvisoSalida();

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      onInput={salida.marcarSucio}
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        if (!event.currentTarget.reportValidity()) return;
        setError(null);
        setAbierto(true);
      }}
    >
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{descripcion}</p>
      {children}
      <Button type="submit" variant="secundario" disabled={lectura}>
        {etiqueta}
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo={titulo}
        descripcion={descripcion}
        etiquetaConfirmar={etiqueta}
        cargando={cargando}
        error={error}
        alCerrar={() => {
          if (!cargando) setAbierto(false);
        }}
        alConfirmar={() => {
          if (!formulario.current) return;
          setCargando(true);
          setError(null);
          void alConfirmar(new FormData(formulario.current)).then((resultado) => {
            setCargando(false);
            if (!resultado.ok) {
              setError(resultado.error);
              return;
            }
            setAbierto(false);
            salida.limpiar();
            publicar("exito", resultado.aviso);
            router.refresh();
          });
        }}
      />
    </form>
  );
}
