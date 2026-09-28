"use client";

import { useState } from "react";

import { guardarOfertaAccion } from "@/app/t/[slug]/ofertas/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";
import { campoFechaBolivia, etiquetaEstado, etiquetaTipo, type EstadoOferta } from "@/lib/ofertas/reglas";
import type { DisponibilidadOferta, OfertaLista } from "@/lib/ofertas/servicio";

type Producto = { id: string; nombre: string };
type Sucursal = { id: string; nombre: string };

export function OfertasPanel({
  slug,
  lectura,
  puedeTienda,
  ofertas,
  productos,
  sucursales,
  disponibilidad,
  sucursalFija,
}: {
  slug: string;
  lectura: boolean;
  puedeTienda: boolean;
  ofertas: OfertaLista[];
  productos: Producto[];
  sucursales: Sucursal[];
  disponibilidad: DisponibilidadOferta[];
  sucursalFija: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {lectura ? null : (
        <FormularioOferta
          slug={slug}
          puedeTienda={puedeTienda}
          productos={productos}
          sucursales={sucursales}
          disponibilidad={disponibilidad}
          sucursalFija={sucursalFija}
          oferta={null}
        />
      )}
      {ofertas.length === 0 ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Todavía no hay ofertas en esta vista.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ofertas.map((oferta) => (
            <li key={oferta.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_8rem]">
              <TarjetaOferta
                slug={slug}
                oferta={oferta}
                lectura={lectura || (!puedeTienda && oferta.sucursalId === null)}
                puedeTienda={puedeTienda}
                productos={productos}
                sucursales={sucursales}
                disponibilidad={disponibilidad}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaOferta({
  slug,
  oferta,
  lectura,
  puedeTienda,
  productos,
  sucursales,
  disponibilidad,
}: {
  slug: string;
  oferta: OfertaLista;
  lectura: boolean;
  puedeTienda: boolean;
  productos: Producto[];
  sucursales: Sucursal[];
  disponibilidad: DisponibilidadOferta[];
}) {
  const [editando, setEditando] = useState(false);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-pretty text-base font-semibold">{oferta.producto}</h3>
        <Etiqueta estado={oferta.estado} />
      </div>
      <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {etiquetaTipo(oferta.tipo)}: {oferta.tipo === "porcentaje" ? `${oferta.valor}%` : formatoBs(oferta.valor)}
        {" · "}
        {oferta.sucursal ?? "Todas las sucursales"}
      </p>
      {lectura ? null : editando ? (
        <FormularioOferta
          slug={slug}
          puedeTienda={puedeTienda}
          productos={productos}
          sucursales={sucursales}
          disponibilidad={disponibilidad}
          sucursalFija={oferta.sucursalId}
          oferta={oferta}
          alCerrar={() => setEditando(false)}
        />
      ) : (
        <Button type="button" variant="secundario" onClick={() => setEditando(true)}>
          Editar
        </Button>
      )}
    </article>
  );
}

function FormularioOferta({
  slug,
  puedeTienda,
  productos,
  sucursales,
  disponibilidad,
  sucursalFija,
  oferta,
  alCerrar,
}: {
  slug: string;
  puedeTienda: boolean;
  productos: Producto[];
  sucursales: Sucursal[];
  disponibilidad: DisponibilidadOferta[];
  sucursalFija: string | null;
  oferta: OfertaLista | null;
  alCerrar?: () => void;
}) {
  const publicar = useToast();
  const idForm = oferta ? `oferta-${oferta.id}` : "oferta-nueva";
  const [tipo, setTipo] = useState(oferta?.tipo ?? "porcentaje");
  const [sucursalId, setSucursalId] = useState(
    oferta?.sucursalId ?? sucursalFija ?? (puedeTienda ? "" : (sucursales[0]?.id ?? "")),
  );
  const productosVisibles = sucursalId
    ? productos.filter((producto) =>
        disponibilidad.some((fila) => fila.productoId === producto.id && fila.sucursalId === sucursalId),
      )
    : productos;
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById(idForm) as HTMLFormElement);
    const resultado = await guardarOfertaAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      id={idForm}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          if (!oferta) event.currentTarget.reset();
          alCerrar?.();
        });
      }}
    >
      {oferta ? <input type="hidden" name="id" value={oferta.id} /> : null}
      <h3 className="text-pretty text-base font-semibold">{oferta ? "Editar oferta" : "Nueva oferta"}</h3>
      <Campo id={`${idForm}-producto`} etiqueta="Producto">
        <select
          id={`${idForm}-producto`}
          name="productoId"
          required
          defaultValue={oferta?.productoId ?? ""}
          className={claseCampo}
        >
          <option value="">Elige un producto</option>
          {productosVisibles.map((producto) => (
            <option key={producto.id} value={producto.id}>
              {producto.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`${idForm}-tipo`} etiqueta="Tipo">
        <select
          id={`${idForm}-tipo`}
          name="tipo"
          required
          value={tipo}
          onChange={(event) => {
            const siguiente = event.target.value === "precio_fijo" ? "precio_fijo" : "porcentaje";
            setTipo(siguiente);
            if (siguiente === "precio_fijo" && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
          }}
          className={claseCampo}
        >
          <option value="porcentaje">Porcentaje sobre el precio de la sucursal</option>
          <option value="precio_fijo">Precio fijo de una sucursal</option>
        </select>
      </Campo>
      <Campo id={`${idForm}-sucursal`} etiqueta="Sucursal">
        <select
          id={`${idForm}-sucursal`}
          name="sucursalId"
          required={tipo === "precio_fijo" || !puedeTienda}
          value={sucursalId}
          onChange={(event) => setSucursalId(event.target.value)}
          className={claseCampo}
        >
          {puedeTienda && tipo === "porcentaje" ? <option value="">Todas las sucursales</option> : null}
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        id={`${idForm}-valor`}
        etiqueta={tipo === "porcentaje" ? "Porcentaje" : "Precio fijo"}
        ayuda={tipo === "porcentaje" ? "Del 0 al 100, sobre el precio base." : "En bolivianos, solo para esa sucursal."}
      >
        <input
          id={`${idForm}-valor`}
          name="valor"
          inputMode="decimal"
          autoComplete="off"
          required
          aria-describedby={`${idForm}-valor-ayuda`}
          defaultValue={oferta ? String(oferta.valor) : ""}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <Campo id={`${idForm}-inicio`} etiqueta="Empieza">
        <input
          id={`${idForm}-inicio`}
          name="inicio"
          type="datetime-local"
          required
          autoComplete="off"
          defaultValue={oferta ? campoFechaBolivia(oferta.inicio) : ""}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`${idForm}-fin`} etiqueta="Termina">
        <input
          id={`${idForm}-fin`}
          name="fin"
          type="datetime-local"
          required
          autoComplete="off"
          defaultValue={oferta ? campoFechaBolivia(oferta.fin) : ""}
          className={claseCampo}
        />
      </Campo>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={oferta ? oferta.activa : true} />
        Activa
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
          Guardar oferta
        </Button>
        {alCerrar ? (
          <Button type="button" variant="fantasma" onClick={alCerrar}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Etiqueta({ estado }: { estado: EstadoOferta }) {
  const tono =
    estado === "vigente"
      ? "text-emerald-800 dark:text-emerald-200"
      : estado === "programada"
        ? "text-sky-800 dark:text-sky-200"
        : "text-zinc-600 dark:text-zinc-400";
  return <p className={`text-sm font-medium ${tono}`}>{etiquetaEstado(estado)}</p>;
}
