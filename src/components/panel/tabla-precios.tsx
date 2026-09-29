"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarPrecioCentralAccion, guardarPrecioSucursalAccion } from "@/app/t/[slug]/productos/actions";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { formatoBs } from "@/lib/catalogo/reglas";
import type { ProductoLista, SucursalCatalogo } from "@/lib/catalogo/tipos";

type Edicion = { productoId: string; columna: string };

export function TablaPreciosDueno({
  slug,
  lectura,
  productos,
  sucursales,
}: {
  slug: string;
  lectura: boolean;
  productos: ProductoLista[];
  sucursales: SucursalCatalogo[];
}) {
  const [edicion, setEdicion] = useState<Edicion | null>(null);

  if (productos.length === 0) return null;

  return (
    <div className="panel-scroll-x">
      <table className="panel-tabla min-w-[40rem]">
        <caption className="sr-only">Precios por sucursal</caption>
        <thead>
          <tr>
            <th className="panel-tabla-fija">Producto</th>
            <th className="px-3 py-2 font-medium">Central</th>
            {sucursales.map((sucursal) => (
              <th key={sucursal.id} className="px-3 py-2 font-medium">
                <span className="break-words">{sucursal.nombre}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {productos.map((producto) => (
            <tr key={producto.id} className="align-top">
              <th
                scope="row"
                className="panel-tabla-fija font-medium"
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 72px" }}
              >
                <span className="break-words">{producto.nombre}</span>
                {producto.activo ? null : <span className="mt-1 block text-xs font-normal">Inactivo</span>}
              </th>
              <td className="px-3 py-3">
                <CeldaCentral
                  slug={slug}
                  lectura={lectura}
                  producto={producto}
                  abierta={edicion?.productoId === producto.id && edicion.columna === "central"}
                  alAbrir={() => setEdicion({ productoId: producto.id, columna: "central" })}
                  alCerrar={() => setEdicion(null)}
                />
              </td>
              {sucursales.map((sucursal) => {
                const oferta = producto.ofertas.find((item) => item.sucursalId === sucursal.id);
                return (
                  <td key={sucursal.id} className="px-3 py-3">
                    <CeldaSucursal
                      slug={slug}
                      lectura={lectura}
                      producto={producto}
                      sucursalId={sucursal.id}
                      oferta={oferta}
                      abierta={edicion?.productoId === producto.id && edicion.columna === sucursal.id}
                      alAbrir={() => setEdicion({ productoId: producto.id, columna: sucursal.id })}
                      alCerrar={() => setEdicion(null)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListaPreciosGerente({
  slug,
  lectura,
  productos,
  sucursalId,
  permitenPrecioPropio,
  margenMax,
}: {
  slug: string;
  lectura: boolean;
  productos: ProductoLista[];
  sucursalId: string;
  permitenPrecioPropio: boolean;
  margenMax: number | null;
}) {
  const visibles = productos.filter((producto) =>
    producto.ofertas.some((oferta) => oferta.sucursalId === sucursalId && oferta.disponible),
  );

  if (visibles.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {visibles.map((producto) => {
        const oferta = producto.ofertas.find((item) => item.sucursalId === sucursalId);
        if (!oferta) return null;
        return (
          <li
            key={producto.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
          >
            <div>
              <p className="break-words font-semibold">{producto.nombre}</p>
              <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                Central {formatoBs(producto.precioCentral)}
              </p>
            </div>
            <EditorPropio
              slug={slug}
              lectura={lectura || !permitenPrecioPropio}
              productoId={producto.id}
              sucursalId={sucursalId}
              usaPrecioCentral={oferta.usaPrecioCentral || !permitenPrecioPropio}
              precioPropio={oferta.precioPropio}
              ayuda={
                permitenPrecioPropio
                  ? margenMax === null
                    ? "Puedes fijar el precio de tu sucursal."
                    : `El precio propio no puede superar el central en más de ${margenMax} %.`
                  : "La tienda obliga el precio central."
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export function TablaPreciosLectura({
  productos,
  sucursales,
}: {
  productos: ProductoLista[];
  sucursales: SucursalCatalogo[];
}) {
  if (productos.length === 0) return null;
  return (
    <div className="panel-scroll-x">
      <table className="panel-tabla min-w-[36rem]">
        <caption className="sr-only">Precios por sucursal</caption>
        <thead>
          <tr>
            <th className="px-3 py-2 font-medium">Producto</th>
            {sucursales.map((sucursal) => (
              <th key={sucursal.id} className="px-3 py-2 font-medium">
                {sucursal.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {productos.map((producto) => (
            <tr key={producto.id}>
              <th scope="row" className="break-words px-3 py-3 font-medium">
                {producto.nombre}
              </th>
              {sucursales.map((sucursal) => {
                const oferta = producto.ofertas.find((item) => item.sucursalId === sucursal.id && item.disponible);
                return (
                  <td key={sucursal.id} className="px-3 py-3 tabular-nums">
                    {oferta?.precioEfectivo == null ? (
                      "No se ofrece"
                    ) : (
                      <>
                        {formatoBs(oferta.precioEfectivo)}{" "}
                        <Tag tono={oferta.usaPrecioCentral ? "neutro" : "warn"}>
                          {oferta.usaPrecioCentral ? "Central" : "Propio"}
                        </Tag>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CeldaCentral({
  slug,
  lectura,
  producto,
  abierta,
  alAbrir,
  alCerrar,
}: {
  slug: string;
  lectura: boolean;
  producto: ProductoLista;
  abierta: boolean;
  alAbrir: () => void;
  alCerrar: () => void;
}) {
  if (!abierta) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="tabular-nums">{formatoBs(producto.precioCentral)}</span>
        <button
          type="button"
          disabled={lectura}
          onClick={alAbrir}
          aria-label={`Editar precio central de ${producto.nombre}`}
          className="min-h-11 touch-manipulation text-sm font-medium underline underline-offset-4 disabled:opacity-50"
        >
          Editar
        </button>
      </div>
    );
  }
  return (
    <EditorNumero
      id={`central-${producto.id}`}
      etiqueta="Precio central"
      valor={producto.precioCentral.toFixed(2)}
      alCancelar={alCerrar}
      alGuardar={(precio) => guardarPrecioCentralAccion(slug, producto.id, precio)}
    />
  );
}

function CeldaSucursal({
  slug,
  lectura,
  producto,
  sucursalId,
  oferta,
  abierta,
  alAbrir,
  alCerrar,
}: {
  slug: string;
  lectura: boolean;
  producto: ProductoLista;
  sucursalId: string;
  oferta: ProductoLista["ofertas"][number] | undefined;
  abierta: boolean;
  alAbrir: () => void;
  alCerrar: () => void;
}) {
  if (!oferta?.disponible) return <span className="text-zinc-600 dark:text-zinc-400">No se ofrece</span>;
  const propio = !oferta.usaPrecioCentral;
  const precio = oferta.precioEfectivo ?? producto.precioCentral;
  if (!abierta) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="tabular-nums">{formatoBs(precio)}</span>
        <Tag tono={propio ? "warn" : "neutro"}>{propio ? "Propio" : "Central"}</Tag>
        <button
          type="button"
          disabled={lectura}
          onClick={alAbrir}
          aria-label={`Editar precio de ${producto.nombre} en esta sucursal`}
          className="min-h-11 touch-manipulation text-sm font-medium underline underline-offset-4 disabled:opacity-50"
        >
          Editar
        </button>
      </div>
    );
  }
  return (
    <EditorPropio
      slug={slug}
      lectura={lectura}
      productoId={producto.id}
      sucursalId={sucursalId}
      usaPrecioCentral={!propio}
      precioPropio={oferta.precioPropio}
      ayuda="Central usa el precio de la tienda. Propio vale solo en esta sucursal."
      alListo={alCerrar}
    />
  );
}

function EditorNumero({
  id,
  etiqueta,
  valor,
  alCancelar,
  alGuardar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCancelar: () => void;
  alGuardar: (precio: string) => Promise<{ ok: true; aviso: string } | { ok: false; error: string }>;
}) {
  const [precio, setPrecio] = useState(valor);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const publicar = useToast();
  const router = useRouter();

  return (
    <form
      className="flex min-w-36 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        setCargando(true);
        setError(null);
        setExito(false);
        void alGuardar(precio).then((resultado) => {
          setCargando(false);
          if (!resultado.ok) {
            setError(resultado.error);
            publicar("error", resultado.error);
            return;
          }
          setExito(true);
          publicar("exito", resultado.aviso);
          router.refresh();
        });
      }}
    >
      <label htmlFor={id} className="text-xs font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        required
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        min={0}
        step="0.01"
        value={precio}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setPrecio(event.target.value)}
        className="h-12 rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 tabular-nums text-[var(--campo-tx)]"
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" loading={cargando} success={exito} error={Boolean(error)}>
        Guardar
      </Button>
      <button type="button" onClick={alCancelar} className="min-h-11 touch-manipulation text-sm underline underline-offset-4">
        Cancelar
      </button>
    </form>
  );
}

function EditorPropio({
  slug,
  lectura,
  productoId,
  sucursalId,
  usaPrecioCentral,
  precioPropio,
  ayuda,
  alListo,
}: {
  slug: string;
  lectura: boolean;
  productoId: string;
  sucursalId: string;
  usaPrecioCentral: boolean;
  precioPropio: number | null;
  ayuda: string;
  alListo?: () => void;
}) {
  const [propio, setPropio] = useState(!usaPrecioCentral);
  const [base, setBase] = useState(usaPrecioCentral);
  const [precio, setPrecio] = useState(precioPropio?.toFixed(2) ?? "");
  const [cargando, setCargando] = useState(false);
  const publicar = useToast();
  const router = useRouter();
  const id = `propio-${productoId}-${sucursalId}`;

  if (usaPrecioCentral !== base) {
    setBase(usaPrecioCentral);
    setPropio(!usaPrecioCentral);
    setPrecio(precioPropio?.toFixed(2) ?? "");
  }

  return (
    <form
      className="flex min-w-40 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (lectura) return;
        if (propio && !event.currentTarget.reportValidity()) return;
        setCargando(true);
        void guardarPrecioSucursalAccion(slug, productoId, sucursalId, !propio, precio).then((resultado) => {
          setCargando(false);
          if (!resultado.ok) {
            publicar("error", resultado.error);
            return;
          }
          publicar("exito", resultado.aviso);
          alListo?.();
          router.refresh();
        });
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={propio}
        aria-describedby={`${id}-ayuda`}
        disabled={lectura || cargando}
        onClick={() => setPropio((actual) => !actual)}
        className="inline-flex min-h-11 touch-manipulation items-center gap-3 text-left text-sm font-medium disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full ${propio ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white motion-reduce:transition-none dark:bg-zinc-950 ${propio ? "translate-x-5" : "translate-x-0.5"} transition-transform`}
          />
        </span>
        {propio ? "Precio propio" : "Precio central"}
      </button>
      <p id={`${id}-ayuda`} className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        {ayuda}
      </p>
      {propio ? (
        <>
          <label htmlFor={id} className="text-xs font-medium">
            Precio propio en Bs
          </label>
          <input
            id={id}
            required
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            min={0}
            step="0.01"
            value={precio}
            disabled={lectura}
            onChange={(event) => setPrecio(event.target.value)}
            className="h-12 rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 tabular-nums text-[var(--campo-tx)]"
          />
        </>
      ) : null}
      <Button type="submit" size="sm" loading={cargando} disabled={lectura} loadingLabel="Guardando…">
        Guardar
      </Button>
    </form>
  );
}
