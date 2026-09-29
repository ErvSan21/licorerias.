"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  agregarStockAccion,
  cambiarActivoProductoAccion,
  crearProductoRapidoAccion,
  editarProductoRapidoAccion,
  eliminarProductoAccion,
} from "@/app/t/[slug]/productos/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { PestanasProductos } from "@/components/panel/pestanas-productos";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { CargarImagen } from "@/components/ui/cargar-imagen";
import { ImagenConCarga } from "@/components/ui/imagen";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";
import { comprimirImagen } from "@/lib/catalogo/imagen-cliente";
import { capitalizar } from "@/lib/texto";

export type ProductoTarjeta = {
  id: string;
  nombre: string;
  categoria: string | null;
  categoriaId: string | null;
  imagenUrl: string | null;
  precio: number;
  precioCentral: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  /** Sucursales visibles donde se ofrece, para elegir dónde agregar stock. */
  sucursales: { id: string; nombre: string; stock: number }[];
};

type Permisos = { crear: boolean; stock: boolean; suspender: boolean; eliminar: boolean };
type Hoja = "stock" | "precio" | "suspender" | "eliminar";
type Opcion = { id: string; nombre: string };

export function ProductosPanel({
  slug,
  productos,
  categorias,
  sucursalesAlta,
  sucursalActual,
  permisos,
}: {
  slug: string;
  productos: ProductoTarjeta[];
  categorias: Opcion[];
  sucursalesAlta: Opcion[];
  sucursalActual: Opcion | null;
  permisos: Permisos;
}) {
  const [crear, setCrear] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const texto = busqueda.trim().toLocaleLowerCase("es");
  const visibles = texto
    ? productos.filter((producto) =>
        producto.nombre.toLocaleLowerCase("es").includes(texto),
      )
    : productos;

  return (
    <main className="flex flex-col gap-4">
      <PestanasProductos slug={slug} activa="productos" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-pretty text-lg font-semibold">
          Productos{sucursalActual ? ` · ${sucursalActual.nombre}` : ""}
        </h2>
        {permisos.crear ? (
          <Button type="button" size="sm" onClick={() => setCrear(true)}>
            + Agregar producto
          </Button>
        ) : null}
      </div>

      {productos.length > 0 ? (
        <input
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className={claseCampo}
        />
      ) : null}

      {productos.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay productos"
          descripcion={
            permisos.crear
              ? "Agrega el primero con el botón de arriba."
              : "No hay productos en esta sucursal."
          }
        />
      ) : visibles.length === 0 ? (
        <EmptyState
          titulo="No hay productos"
          descripcion="Prueba con otro nombre."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibles.map((producto) => (
            <li key={producto.id}>
              <TarjetaProducto
                slug={slug}
                producto={producto}
                permisos={permisos}
                sucursalActual={sucursalActual}
                categorias={categorias}
              />
            </li>
          ))}
        </ul>
      )}

      <Drawer
        abierto={crear}
        titulo="Nuevo producto"
        alCerrar={() => setCrear(false)}
      >
        {crear ? (
          <FormularioProductoHoja
            slug={slug}
            categorias={categorias}
            sucursales={sucursalesAlta}
            sucursalActual={sucursalActual}
            alCerrar={() => setCrear(false)}
          />
        ) : null}
      </Drawer>
    </main>
  );
}

function TarjetaProducto({
  slug,
  producto,
  permisos,
  sucursalActual,
  categorias,
}: {
  slug: string;
  producto: ProductoTarjeta;
  permisos: Permisos;
  sucursalActual: Opcion | null;
  categorias: Opcion[];
}) {
  const router = useRouter();
  const publicar = useToast();
  const [menu, setMenu] = useState(false);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cierra la lista al tocar fuera o con Escape.
  useEffect(() => {
    if (!menu) return;
    function fuera(event: PointerEvent) {
      if (!contenedor.current?.contains(event.target as Node)) setMenu(false);
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const agotado = producto.stock <= 0;
  const bajo = !agotado && producto.stock <= producto.stockMinimo;
  const hayAcciones = permisos.stock || permisos.suspender || permisos.crear || permisos.eliminar;

  function abrir(siguiente: Hoja) {
    setMenu(false);
    setHoja(siguiente);
  }

  function listo(aviso: string) {
    publicar("exito", aviso);
    setHoja(null);
    router.refresh();
  }

  return (
    <>
      <article
        className={`producto-tarjeta ${producto.activo ? "" : "producto-tarjeta-suspendido"}`}
        aria-label={producto.nombre}
      >
        {producto.imagenUrl ? (
          <ImagenConCarga
            src={producto.imagenUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl"
          />
        ) : (
          <div aria-hidden="true" className="producto-tarjeta-sin-imagen">
            {producto.nombre.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words font-semibold">{producto.nombre}</p>
            {producto.activo ? null : <Tag tono="warn">Suspendido</Tag>}
          </div>
          {producto.categoria ? (
            <p className="text-xs text-[var(--mu)]">{producto.categoria}</p>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-display text-[17px] font-extrabold tabular-nums">
              {formatoBs(producto.precio)}
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${agotado ? "text-[var(--er)]" : bajo ? "text-[var(--wa)]" : "text-[var(--mu)]"}`}
            >
              Stock {producto.stock}
            </span>
          </div>
        </div>
        {hayAcciones ? (
          <div ref={contenedor} className="producto-acciones relative self-start">
            <button
              type="button"
              className="boton-icono"
              aria-label={`Acciones de ${producto.nombre}`}
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={(event) => {
                const caja = event.currentTarget.getBoundingClientRect();
                setHaciaArriba(caja.bottom > window.innerHeight - 280);
                setMenu((abierto) => !abierto);
              }}
            >
              <span aria-hidden>⋮</span>
            </button>
            {menu ? (
              <ul role="menu" className={`producto-menu ui-movimiento ${haciaArriba ? "producto-menu-arriba" : ""}`}>
                {permisos.stock ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={() => abrir("stock")}>
                      Agregar stock
                    </button>
                  </li>
                ) : null}
                {permisos.crear ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={() => abrir("precio")}>
                      Editar producto
                    </button>
                  </li>
                ) : null}
                <li role="none">
                  <Link
                    role="menuitem"
                    href={`/t/${slug}/inventario/${producto.id}${sucursalActual ? `?sucursal=${sucursalActual.id}` : ""}`}
                  >
                    Ver movimientos
                  </Link>
                </li>
                {permisos.suspender ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={() => abrir("suspender")}>
                      {producto.activo ? "Suspender" : "Reactivar"}
                    </button>
                  </li>
                ) : null}
                {permisos.eliminar ? (
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="text-[var(--er)]"
                      onClick={() => abrir("eliminar")}
                    >
                      Eliminar
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </article>

      {/* Las hojas van fuera de la tarjeta para no heredar su opacidad. */}
      <Drawer
        abierto={hoja === "stock"}
        titulo="Agregar stock"
        descripcion={producto.nombre}
        alCerrar={() => setHoja(null)}
      >
        {hoja === "stock" ? (
          <FormularioStock
            slug={slug}
            producto={producto}
            sucursalActual={sucursalActual}
            alCerrar={() => setHoja(null)}
            alListo={listo}
          />
        ) : null}
      </Drawer>

      <Drawer
        abierto={hoja === "suspender"}
        titulo={producto.activo ? "Suspender producto" : "Reactivar producto"}
        descripcion={
          producto.activo
            ? "Deja de aparecer en Ventas y en la tienda en línea. El stock y el historial se conservan."
            : "Vuelve a aparecer en Ventas y en la tienda en línea."
        }
        alCerrar={() => setHoja(null)}
      >
        {hoja === "suspender" ? (
          <ConfirmarSuspension
            slug={slug}
            producto={producto}
            alCerrar={() => setHoja(null)}
            alListo={listo}
          />
        ) : null}
      </Drawer>

      <Drawer abierto={hoja === "precio"} titulo="Editar producto" alCerrar={() => setHoja(null)}>
        {hoja === "precio" ? (
          <FormularioProductoHoja
            slug={slug}
            categorias={categorias}
            producto={producto}
            alCerrar={() => setHoja(null)}
            alListo={listo}
          />
        ) : null}
      </Drawer>

      <Drawer
        abierto={hoja === "eliminar"}
        titulo="Eliminar producto"
        descripcion={`Se borra ${producto.nombre} y su stock. No se puede deshacer. Si ya tiene ventas, suspéndelo en su lugar.`}
        alCerrar={() => setHoja(null)}
      >
        {hoja === "eliminar" ? (
          <ConfirmarEliminar slug={slug} producto={producto} alCerrar={() => setHoja(null)} alListo={listo} />
        ) : null}
      </Drawer>
    </>
  );
}

function ConfirmarEliminar({
  slug,
  producto,
  alCerrar,
  alListo,
}: {
  slug: string;
  producto: ProductoTarjeta;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await eliminarProductoAccion(slug, producto.id);
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

function FormularioStock({
  slug,
  producto,
  sucursalActual,
  alCerrar,
  alListo,
}: {
  slug: string;
  producto: ProductoTarjeta;
  sucursalActual: Opcion | null;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const [sucursalId, setSucursalId] = useState(
    sucursalActual?.id ?? producto.sucursales[0]?.id ?? "",
  );
  const [cantidad, setCantidad] = useState("");
  const actual = producto.sucursales.find(
    (sucursal) => sucursal.id === sucursalId,
  );
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await agregarStockAccion(slug, {
      productoId: producto.id,
      sucursalId,
      cantidad: Number(cantidad),
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  if (producto.sucursales.length === 0) {
    return (
      <>
        <p className="text-sm leading-6">
          Este producto no se ofrece en ninguna sucursal. Edítalo para elegir
          dónde se vende.
        </p>
        <PieHoja alCancelar={alCerrar} deshabilitado />
      </>
    );
  }

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
      {sucursalActual || producto.sucursales.length === 1 ? null : (
        <Campo id={`stock-sucursal-${producto.id}`} etiqueta="Sucursal">
          <select
            id={`stock-sucursal-${producto.id}`}
            value={sucursalId}
            onChange={(event) => setSucursalId(event.target.value)}
            className={claseCampo}
          >
            {producto.sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </Campo>
      )}
      <p className="text-sm text-[var(--mu)]">
        Stock actual:{" "}
        <b className="tabular-nums text-[var(--tx)]">{actual?.stock ?? 0}</b>
      </p>
      <Campo id={`stock-cantidad-${producto.id}`} etiqueta="Unidades a agregar">
        <input
          id={`stock-cantidad-${producto.id}`}
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={100000}
          step={1}
          autoComplete="off"
          value={cantidad}
          onChange={(event) => setCantidad(event.target.value)}
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

function ConfirmarSuspension({
  slug,
  producto,
  alCerrar,
  alListo,
}: {
  slug: string;
  producto: ProductoTarjeta;
  alCerrar: () => void;
  alListo: (aviso: string) => void;
}) {
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await cambiarActivoProductoAccion(
      slug,
      producto.id,
      !producto.activo,
    );
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
      <PieHoja
        peligro={producto.activo}
        alCancelar={alCerrar}
        cargando={loading}
      />
    </form>
  );
}

/** Crear o editar un producto: nombre, precio, categoría e imagen (y stock inicial al crear). */
function FormularioProductoHoja({
  slug,
  categorias,
  producto = null,
  sucursales = [],
  sucursalActual = null,
  alCerrar,
  alListo,
}: {
  slug: string;
  categorias: Opcion[];
  /** Si viene, se edita; si no, se crea. */
  producto?: ProductoTarjeta | null;
  sucursales?: Opcion[];
  sucursalActual?: Opcion | null;
  alCerrar: () => void;
  alListo?: (aviso: string) => void;
}) {
  const router = useRouter();
  const publicar = useToast();
  const edicion = producto != null;
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [precio, setPrecio] = useState(producto ? producto.precioCentral.toFixed(2) : "");
  const [stock, setStock] = useState("");
  const [categoriaId, setCategoriaId] = useState(
    producto ? (producto.categoriaId ?? "") : (categorias[0]?.id ?? "nueva"),
  );
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const stockEn = sucursalActual ? [sucursalActual.id] : sucursales.map((sucursal) => sucursal.id);
  const { run, loading, error } = useAsyncAction(async () => {
    const datos = new FormData();
    datos.set("nombre", nombre);
    datos.set("precioCentral", precio);
    if (categoriaId === "nueva") datos.set("nuevaCategoria", nuevaCategoria);
    else if (categoriaId) datos.set("categoriaId", categoriaId);
    if (archivo) datos.set("imagen", await comprimirImagen(archivo));
    if (edicion) {
      const resultado = await editarProductoRapidoAccion(slug, producto.id, datos);
      if (!resultado.ok) throw new Error(resultado.error);
      return resultado.aviso;
    }
    datos.set("stock", stock || "0");
    for (const sucursal of sucursales) datos.append("sucursal", sucursal.id);
    for (const id of stockEn) datos.append("stockEn", id);
    const resultado = await crearProductoRapidoAccion(slug, datos);
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
          if (alListo) {
            alListo(hecho.valor.valor);
            return;
          }
          publicar("exito", hecho.valor.valor);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <Campo id="producto-nombre" etiqueta="Nombre">
        <input
          id="producto-nombre"
          required
          minLength={2}
          maxLength={120}
          autoComplete="off"
          autoCapitalize="sentences"
          value={nombre}
          onChange={(event) => setNombre(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <div className={`grid gap-3 ${edicion ? "grid-cols-1" : "grid-cols-2"}`}>
        <Campo id="producto-precio" etiqueta="Precio (Bs)">
          <input
            id="producto-precio"
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="0.01"
            autoComplete="off"
            value={precio}
            onChange={(event) => setPrecio(event.target.value)}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
        {edicion ? null : (
          <Campo id="producto-stock" etiqueta="Stock inicial">
            <input
              id="producto-stock"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              autoComplete="off"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className={`${claseCampo} tabular-nums`}
            />
          </Campo>
        )}
      </div>
      {!edicion && !sucursalActual && sucursales.length > 1 ? (
        <p className="-mt-1 text-xs text-[var(--mu)]">El stock inicial se carga en cada sucursal.</p>
      ) : null}
      {edicion && producto.precio !== producto.precioCentral ? (
        <p className="-mt-1 text-xs text-[var(--mu)]">
          Esta sucursal usa un precio propio de {formatoBs(producto.precio)}. Se cambia en Precios por sucursal.
        </p>
      ) : null}
      <Campo id="producto-categoria" etiqueta="Categoría">
        <select
          id="producto-categoria"
          value={categoriaId}
          onChange={(event) => setCategoriaId(event.target.value)}
          className={claseCampo}
        >
          {edicion ? <option value="">Sin categoría</option> : null}
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
          <option value="nueva">Nueva categoría…</option>
        </select>
      </Campo>
      {categoriaId === "nueva" ? (
        <Campo id="producto-nueva-categoria" etiqueta="Nombre de la categoría">
          <input
            id="producto-nueva-categoria"
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="sentences"
            value={nuevaCategoria}
            onChange={(event) => setNuevaCategoria(capitalizar(event.target.value))}
            className={claseCampo}
          />
        </Campo>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Imagen</span>
        <CargarImagen actual={producto?.imagenUrl ?? null} onChange={setArchivo} deshabilitado={loading} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando={edicion ? "Guardando…" : "Creando…"} />
    </form>
  );
}
