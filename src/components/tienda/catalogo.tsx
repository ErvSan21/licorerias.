"use client";

import { useDeferredValue, useState } from "react";

import { Campo, claseCampo } from "@/components/super/campo";
import { useTienda } from "@/components/tienda/contexto";
import { Button } from "@/components/ui/button";
import { ChipCategoria } from "@/components/ui/chip-categoria";
import { Dialogo } from "@/components/ui/dialogo";
import { ImagenConCarga } from "@/components/ui/imagen";
import { formatoBs } from "@/lib/catalogo/reglas";
import { TIPOS_BEBIDA, tipoDeBebida, type TipoBebida } from "@/lib/catalogo/tipo-bebida";
import type { ProductoPublico } from "@/lib/tienda/servicio";

export function Catalogo() {
  const { estado, acciones, meta } = useTienda();
  const [tipo, setTipo] = useState<TipoBebida>("Todos");
  const consulta = useDeferredValue(estado.busqueda);
  const atenuada = consulta !== estado.busqueda;
  const texto = consulta.trim().toLocaleLowerCase("es");
  const productos = meta.vitrina.productos.filter((producto) => {
    if (tipo !== "Todos" && tipoDeBebida(producto.nombre) !== tipo) return false;
    if (!texto) return true;
    return producto.nombre.toLocaleLowerCase("es").includes(texto);
  });
  const detalle = estado.detalleId ? meta.productos.get(estado.detalleId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Campo id="buscar-producto" etiqueta="Buscar">
        <input
          id="buscar-producto"
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar producto"
          value={estado.busqueda}
          onChange={(event) => acciones.setBusqueda(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Tipos de bebida">
        {TIPOS_BEBIDA.map((nombre) => (
          <ChipCategoria key={nombre} activo={tipo === nombre} onClick={() => setTipo(nombre)}>
            {nombre}
          </ChipCategoria>
        ))}
      </div>
      {estado.avisos.length > 0 ? (
        <ul aria-live="polite" className="flex flex-col gap-1 text-sm text-zinc-800 dark:text-zinc-200">
          {estado.avisos.map((aviso) => (
            <li key={`${aviso.tipo}-${aviso.productoId}`}>{textoAviso(aviso.tipo, aviso.nombre)}</li>
          ))}
        </ul>
      ) : null}
      <Colecciones />
      <div className={atenuada ? "tienda-atenuada opacity-45" : "tienda-atenuada"}>
        {productos.length === 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">No hay productos con esa búsqueda.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {productos.map((producto) => (
              <li key={producto.id} className="[content-visibility:auto]">
                <Tarjeta producto={producto} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {detalle ? (
        <Dialogo
          abierto
          titulo={detalle.nombre}
          descripcion={detalle.descripcion || undefined}
          alCerrar={acciones.cerrarDetalle}
          alineacion="inferior"
        >
          <Precio producto={detalle} />
          <div className="mt-4">
            <Agregar producto={detalle} />
          </div>
        </Dialogo>
      ) : null}
    </div>
  );
}

function Colecciones() {
  const { meta, acciones } = useTienda();
  if (meta.vitrina.colecciones.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {meta.vitrina.colecciones.map((coleccion) => (
        <section key={coleccion.id} aria-labelledby={`coleccion-${coleccion.id}`}>
          <h3 id={`coleccion-${coleccion.id}`} className="text-pretty text-base font-semibold">
            {coleccion.nombre}
          </h3>
          <ul className="mt-2 flex gap-3 overflow-x-auto">
            {coleccion.productoIds.map((id) => {
              const producto = meta.productos.get(id);
              if (!producto) return null;
              return (
                <li key={id} className="w-36 shrink-0">
                  <button
                    type="button"
                    className="ui-boton flex min-h-11 w-full flex-col gap-1 text-left"
                    onClick={() => acciones.abrirDetalle(producto.id)}
                  >
                    <Foto producto={producto} />
                    <span className="text-sm">{producto.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Tarjeta({ producto }: { producto: ProductoPublico }) {
  const { acciones } = useTienda();
  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
      <button type="button" className="ui-boton text-left" onClick={() => acciones.abrirDetalle(producto.id)}>
        <Foto producto={producto} />
        <h3 className="mt-2 text-pretty text-sm font-semibold">{producto.nombre}</h3>
      </button>
      <Precio producto={producto} />
      <Agregar producto={producto} />
    </article>
  );
}

function Foto({ producto }: { producto: ProductoPublico }) {
  if (!producto.imagenUrl) {
    return <span className="block aspect-[4/3] w-full rounded-lg bg-zinc-100 dark:bg-zinc-900" />;
  }
  return (
    <ImagenConCarga
      src={producto.imagenUrl}
      alt=""
      width={640}
      height={480}
      className="aspect-[4/3] w-full"
    />
  );
}

function Precio({ producto }: { producto: ProductoPublico }) {
  const oferta = producto.origen === "oferta" && producto.precioOriginal > producto.precioFinal;
  return (
    <p className="text-sm tabular-nums">
      {oferta ? (
        <>
          <span className="mr-1 text-xs font-semibold text-amber-800 dark:text-amber-200">OFERTA</span>
          <span className="mr-1 text-zinc-500 line-through">{formatoBs(producto.precioOriginal)}</span>
        </>
      ) : null}
      <span className="font-semibold">{formatoBs(producto.precioFinal)}</span>
    </p>
  );
}

function Agregar({ producto }: { producto: ProductoPublico }) {
  const { acciones } = useTienda();
  if (producto.agotado) {
    return (
      <p className="mt-auto text-sm font-medium text-zinc-600 dark:text-zinc-400">Agotado</p>
    );
  }
  return (
    <Button type="button" variant="secundario" className="mt-auto" onClick={() => acciones.agregar(producto.id)}>
      Agregar
    </Button>
  );
}

function textoAviso(tipo: "precio" | "agotado" | "fuera", nombre: string): string {
  if (tipo === "precio") return `${nombre} cambió de precio.`;
  if (tipo === "agotado") return `${nombre} está agotado en esta sucursal.`;
  return "Un producto ya no está en esta sucursal.";
}
