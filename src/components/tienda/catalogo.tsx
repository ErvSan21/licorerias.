"use client";

import { useDeferredValue, useState } from "react";

import { useTienda } from "@/components/tienda/contexto";
import { ChipCategoria } from "@/components/ui/chip-categoria";
import { Dialogo } from "@/components/ui/dialogo";
import { ImagenConCarga } from "@/components/ui/imagen";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import { formatoBs } from "@/lib/catalogo/reglas";
import { capitalizar } from "@/lib/texto";
import type { ProductoPublico } from "@/lib/tienda/servicio";

function enOferta(producto: ProductoPublico) {
  return producto.origen === "oferta" && producto.precioOriginal > producto.precioFinal;
}

export function Catalogo() {
  const { estado, acciones, meta } = useTienda();
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const consulta = useDeferredValue(estado.busqueda);
  const atenuada = consulta !== estado.busqueda;
  const texto = consulta.trim().toLocaleLowerCase("es");
  const productos = meta.vitrina.productos.filter((producto) => {
    if (categoriaId && producto.categoriaId !== categoriaId) return false;
    if (!texto) return true;
    return producto.nombre.toLocaleLowerCase("es").includes(texto);
  });
  // Solo las categorías que la tienda creó y que tienen productos en esta sucursal.
  const categorias = meta.vitrina.categorias.filter((categoria) =>
    meta.vitrina.productos.some((producto) => producto.categoriaId === categoria.id),
  );
  const sinFiltro = categoriaId === null && !texto;
  const ofertas = sinFiltro ? meta.vitrina.productos.filter((producto) => enOferta(producto) && !producto.agotado) : [];
  const detalle = estado.detalleId ? meta.productos.get(estado.detalleId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <label className="sr-only" htmlFor="buscar-producto">
        Buscar producto
      </label>
      <input
        id="buscar-producto"
        type="search"
        name="q"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Buscar producto"
        value={estado.busqueda}
        onChange={(event) => acciones.setBusqueda(event.target.value)}
        className="tienda-buscar"
      />
      {categorias.length > 0 ? (
        <div className="chips-carrusel" role="group" aria-label="Categorías">
          <ChipCategoria activo={categoriaId === null} onClick={() => setCategoriaId(null)}>
            Todos
          </ChipCategoria>
          {categorias.map((categoria) => (
            <ChipCategoria
              key={categoria.id}
              activo={categoriaId === categoria.id}
              onClick={() => setCategoriaId(categoria.id)}
            >
              {capitalizar(categoria.nombre)}
            </ChipCategoria>
          ))}
        </div>
      ) : null}
      {estado.avisos.length > 0 ? (
        <ul aria-live="polite" className="tienda-aviso flex flex-col gap-1">
          {estado.avisos.map((aviso) => (
            <li key={`${aviso.tipo}-${aviso.productoId}`}>{textoAviso(aviso.tipo, aviso.nombre)}</li>
          ))}
        </ul>
      ) : null}

      {ofertas.length > 0 ? (
        <section aria-labelledby="tienda-ofertas">
          <div className="tienda-seccion">
            <h2 id="tienda-ofertas">Ofertas</h2>
            <span>Precios especiales en {meta.vitrina.sucursal.nombre}</span>
          </div>
          <ul className="tienda-carrusel">
            {ofertas.map((producto) => (
              <li key={producto.id} className="tienda-carrusel-item">
                <Tarjeta producto={producto} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tienda-productos" className={atenuada ? "tienda-atenuada opacity-45" : "tienda-atenuada"}>
        <div className="tienda-seccion">
          <h2 id="tienda-productos">Productos</h2>
          <span className="tabular-nums">
            {productos.length === 1 ? "1 producto" : `${productos.length} productos`}
          </span>
        </div>
        {productos.length === 0 ? (
          <p className="text-sm text-[var(--mu)]">
            {texto ? "No hay productos con esa búsqueda." : "No hay productos en esta categoría. Prueba con otra."}
          </p>
        ) : (
          <ul className="tienda-grilla">
            {productos.map((producto) => (
              <li key={producto.id} className="[content-visibility:auto]">
                <Tarjeta producto={producto} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {detalle ? (
        <Dialogo
          abierto
          titulo={capitalizar(detalle.nombre)}
          descripcion={detalle.descripcion || undefined}
          alCerrar={acciones.cerrarDetalle}
          alineacion="inferior"
        >
          <div className="tienda-detalle-foto">
            <Foto producto={detalle} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Precio producto={detalle} />
            <Cantidad producto={detalle} />
          </div>
        </Dialogo>
      ) : null}
    </div>
  );
}

function Tarjeta({ producto }: { producto: ProductoPublico }) {
  const { acciones } = useTienda();
  const oferta = enOferta(producto);
  return (
    <article className={`tienda-tarjeta ${producto.agotado ? "tienda-tarjeta-agotada" : ""}`}>
      <button
        type="button"
        className="tienda-tarjeta-foto"
        aria-label={`Ver ${capitalizar(producto.nombre)}`}
        onClick={() => acciones.abrirDetalle(producto.id)}
      >
        <Foto producto={producto} />
        {oferta ? (
          <span className="tienda-descuento">
            -{Math.round((1 - producto.precioFinal / producto.precioOriginal) * 100)}%
          </span>
        ) : null}
      </button>
      <div className="tienda-tarjeta-cuerpo">
        <h3 className="tienda-tarjeta-nombre">{capitalizar(producto.nombre)}</h3>
        <Precio producto={producto} />
        <Cantidad producto={producto} />
      </div>
    </article>
  );
}

function Foto({ producto }: { producto: ProductoPublico }) {
  if (!producto.imagenUrl) {
    return (
      <span aria-hidden="true" className="tienda-foto-vacia">
        {producto.nombre.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <ImagenConCarga src={producto.imagenUrl} alt="" width={480} height={480} className="tienda-foto" />;
}

function Precio({ producto }: { producto: ProductoPublico }) {
  return (
    <p className="tienda-precio">
      {enOferta(producto) ? <s>{formatoBs(producto.precioOriginal)}</s> : null}
      <span>{formatoBs(producto.precioFinal)}</span>
    </p>
  );
}

/** − cantidad + en la misma tarjeta; con 0 unidades el − queda deshabilitado. */
function Cantidad({ producto }: { producto: ProductoPublico }) {
  const { estado, acciones } = useTienda();
  if (producto.agotado) {
    return (
      <p className="tienda-agotado" role="status">
        Agotado
      </p>
    );
  }
  const actual = estado.lineas.find((linea) => linea.productoId === producto.id)?.cantidad ?? 0;
  return (
    <SelectorCantidad
      valor={actual}
      etiqueta={`Cantidad de ${capitalizar(producto.nombre)}`}
      onChange={(valor) => {
        if (valor > actual) acciones.agregar(producto.id);
        else acciones.cambiarCantidad(producto.id, valor);
      }}
    />
  );
}

function textoAviso(tipo: "precio" | "agotado" | "fuera", nombre: string): string {
  if (tipo === "precio") return `${nombre} cambió de precio.`;
  if (tipo === "agotado") return `${nombre} está agotado en esta sucursal.`;
  return "Un producto de tu pedido no está en esta sucursal y se quitó.";
}
