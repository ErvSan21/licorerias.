"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { crearVentaAccion } from "@/app/t/[slug]/ventas/actions";
import { MapaCliente } from "@/components/panel/mapa-cliente";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipCategoria } from "@/components/ui/chip-categoria";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLoader } from "@/components/ui/inline-loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { capitalizar } from "@/lib/texto";
import { formatoBs } from "@/lib/catalogo/reglas";
import {
  etiquetaEstadoPedido,
  etiquetaMetodoPago,
  METODOS_PAGO,
  pasosVenta,
  type MetodoPago,
} from "@/lib/pedidos/reglas";

export type ProductoVenta = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  stock: number;
};

export type SucursalVenta = {
  id: string;
  lat: number | null;
  lng: number | null;
  aceptaDelivery: boolean;
  aceptaRecojo: boolean;
};

type Entrega = "recojo" | "delivery";
type Envio = { distanciaKm: number; costo: number };
type Registrado = { id: string; referencia: string; tipo: Entrega };

export function ListaVentas({
  slug,
  sucursal,
  productos,
  categorias,
  lectura,
}: {
  slug: string;
  sucursal: SucursalVenta;
  productos: ProductoVenta[];
  /** Categorías reales de la tienda que tienen productos aquí, en su orden. */
  categorias: string[];
  lectura: boolean;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [registrado, setRegistrado] = useState<Registrado | null>(null);
  const texto = busqueda.trim().toLocaleLowerCase("es");
  const visibles = productos.filter((producto) => {
    if (categoria && producto.categoria !== categoria) return false;
    if (!texto) return true;
    return producto.nombre.toLocaleLowerCase("es").includes(texto);
  });
  const lineas = productos.flatMap((producto) => {
    const cantidad = Math.min(cantidades[producto.id] ?? 0, producto.stock);
    return cantidad > 0 ? [{ ...producto, cantidad }] : [];
  });
  const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  const subtotal = lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precio, 0);

  function cambiar(id: string, valor: number) {
    setCantidades((prev) => ({ ...prev, [id]: valor }));
  }

  if (productos.length === 0) {
    return <EmptyState titulo="No hay productos en esta sucursal" descripcion="Cuando se ofrezcan aquí, aparecen en la lista." />;
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <input
        type="search"
        name="q"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Buscar producto"
        aria-label="Buscar producto"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        className={claseCampo}
      />
      {categorias.length > 0 ? (
        <div className="chips-carrusel" role="group" aria-label="Categorías">
          <ChipCategoria activo={categoria === null} onClick={() => setCategoria(null)}>
            Todos
          </ChipCategoria>
          {categorias.map((nombre) => (
            <ChipCategoria key={nombre} activo={categoria === nombre} onClick={() => setCategoria(nombre)}>
              {capitalizar(nombre)}
            </ChipCategoria>
          ))}
        </div>
      ) : null}
      {visibles.length === 0 ? (
        <EmptyState titulo="No hay productos" descripcion="Prueba otra categoría u otro nombre." />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((producto) => (
            <li key={producto.id}>
              <Card className={`flex items-center justify-between gap-3 p-4 ${producto.stock <= 0 ? "venta-agotada" : ""}`}>
                <div className="min-w-0">
                  <p className="break-words font-semibold">{capitalizar(producto.nombre)}</p>
                  <p className="text-sm tabular-nums text-[var(--mu)]">
                    {formatoBs(producto.precio)} ·{" "}
                    <span className={producto.stock <= 0 ? "font-semibold text-[var(--er)]" : ""}>Stock {producto.stock}</span>
                  </p>
                </div>
                {producto.stock <= 0 ? (
                  <span className="shrink-0 text-sm font-semibold text-[var(--er)]">Agotado</span>
                ) : (
                  <SelectorCantidad
                    valor={cantidades[producto.id] ?? 0}
                    onChange={(valor) => cambiar(producto.id, valor)}
                    max={Math.min(99, producto.stock)}
                    etiqueta={`Cantidad de ${producto.nombre}`}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {unidades > 0 && !abierto ? (
        <button
          type="button"
          key={unidades}
          className="venta-flotante carrito-salto ui-movimiento"
          onClick={() => setAbierto(true)}
          disabled={lectura}
        >
          <span className="venta-flotante-contador tabular-nums">{unidades}</span>
          Realizar pedido · <span className="tabular-nums">{formatoBs(subtotal)}</span>
        </button>
      ) : null}

      <Drawer abierto={abierto} titulo="Tu pedido" alCerrar={() => setAbierto(false)}>
        {abierto ? (
          <FormularioPedido
            slug={slug}
            sucursal={sucursal}
            lineas={lineas}
            subtotal={subtotal}
            cambiar={cambiar}
            alCerrar={() => setAbierto(false)}
            alRegistrar={(pedido) => {
              setAbierto(false);
              setCantidades({});
              setRegistrado(pedido);
            }}
          />
        ) : null}
      </Drawer>

      <Drawer abierto={registrado != null} titulo="Pedido registrado" alCerrar={() => setRegistrado(null)}>
        {registrado ? (
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-0 pl-1.5" aria-label="Pasos del pedido">
              {pasosVenta(registrado.tipo).map((paso, indice) => (
                <li key={paso} className="venta-paso" data-hecho={indice === 0 ? "" : undefined}>
                  <i aria-hidden="true" />
                  <b>{etiquetaEstadoPedido(paso, "panel")}</b>
                </li>
              ))}
            </ol>
            <p className="text-sm text-[var(--mu)]">
              El pedido <b className="tabular-nums text-[var(--tx)]">#{registrado.referencia}</b> quedó registrado en
              Pedidos. Desde ahí avanzas cada paso.
            </p>
            <div className="flex gap-2">
              <Link
                href={`/t/${slug}/pedidos/${registrado.id}`}
                className="ui-boton ui-boton-primario inline-flex min-h-11 flex-1 items-center justify-center rounded-xl font-semibold"
              >
                Ver pedido
              </Link>
              <Button type="button" variant="secundario" className="flex-1" onClick={() => setRegistrado(null)}>
                Nueva venta
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function FormularioPedido({
  slug,
  sucursal,
  lineas,
  subtotal,
  cambiar,
  alCerrar,
  alRegistrar,
}: {
  slug: string;
  sucursal: SucursalVenta;
  lineas: (ProductoVenta & { cantidad: number })[];
  subtotal: number;
  cambiar: (id: string, valor: number) => void;
  alCerrar: () => void;
  alRegistrar: (pedido: Registrado) => void;
}) {
  // Recojo es la opción por defecto (venta de mostrador).
  const [entrega, setEntrega] = useState<Entrega>(
    sucursal.aceptaRecojo || !sucursal.aceptaDelivery ? "recojo" : "delivery",
  );
  const habilitada = entrega === "delivery" ? sucursal.aceptaDelivery : sucursal.aceptaRecojo;
  const [pago, setPago] = useState<MetodoPago>("efectivo");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    sucursal.lat != null && sucursal.lng != null ? { lat: sucursal.lat, lng: sucursal.lng } : null,
  );
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (entrega !== "delivery" || !sucursal.aceptaDelivery || !punto) return;
    const controlador = new AbortController();
    const timer = window.setTimeout(() => {
      setCalculando(true);
      setEnvio(null);
      setEnvioError(null);
      void fetch("/api/envio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sucursalId: sucursal.id, lat: punto.lat, lng: punto.lng }),
        signal: controlador.signal,
      })
        .then(async (respuesta) => {
          const cuerpo = (await respuesta.json().catch(() => null)) as {
            disponible?: boolean;
            distanciaKm?: number;
            costo?: number;
            error?: string;
          } | null;
          if (!respuesta.ok || !cuerpo) {
            setEnvioError(cuerpo?.error || "No se pudo calcular el envío.");
          } else if (!cuerpo.disponible || cuerpo.costo == null || cuerpo.distanciaKm == null) {
            setEnvioError("Fuera de zona de entrega.");
          } else {
            setEnvio({ distanciaKm: cuerpo.distanciaKm, costo: cuerpo.costo });
          }
          setCalculando(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setEnvioError("No se pudo calcular el envío.");
          setCalculando(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controlador.abort();
    };
  }, [entrega, punto, sucursal.id, sucursal.aceptaDelivery]);

  const costoEnvio = entrega === "delivery" ? (envio?.costo ?? null) : 0;
  const listo = lineas.length > 0 && habilitada && (entrega === "recojo" || envio != null);
  const accion = useAsyncAction(async () => {
    const resultado = await crearVentaAccion(slug, {
      sucursalId: sucursal.id,
      nombre,
      telefono,
      tipo: entrega,
      lat: entrega === "delivery" ? (punto?.lat ?? null) : null,
      lng: entrega === "delivery" ? (punto?.lng ?? null) : null,
      direccion,
      referencia: "",
      horaRecojo: null,
      metodoPago: pago,
      items: lineas.map((linea) => ({ productoId: linea.id, cantidad: linea.cantidad })),
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return { id: resultado.id, referencia: resultado.referencia };
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity() || !listo) return;
        void accion.run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          alRegistrar({ ...hecho.valor.valor, tipo: entrega });
        });
      }}
    >
      <ul className="flex flex-col gap-2">
        {lineas.map((linea) => (
          <li key={linea.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block break-words">{capitalizar(linea.nombre)}</span>
              <span className="text-sm tabular-nums text-[var(--mu)]">{formatoBs(linea.precio * linea.cantidad)}</span>
            </span>
            <SelectorCantidad
              valor={linea.cantidad}
              max={Math.min(99, linea.stock)}
              onChange={(valor) => {
                cambiar(linea.id, valor);
                if (valor === 0 && lineas.length === 1) alCerrar();
              }}
              etiqueta={`Cantidad de ${linea.nombre}`}
            />
          </li>
        ))}
      </ul>

      {/* Las opciones de entrega solo se muestran cuando la sucursal acepta las dos. */}
      {sucursal.aceptaDelivery && sucursal.aceptaRecojo ? (
        <SegmentedControl
          etiqueta="Entrega"
          valor={entrega}
          opciones={[
            { valor: "recojo", etiqueta: "Recojo en tienda" },
            { valor: "delivery", etiqueta: "Delivery" },
          ]}
          onChange={setEntrega}
        />
      ) : null}

      {!habilitada ? (
        <p className="text-sm text-[var(--er)]">
          {entrega === "delivery" ? (
            <>
              Esta sucursal no tiene el delivery activado.{" "}
              <Link href={`/t/${slug}/configuracion/envio`} className="font-semibold underline">
                Activarlo en Envío
              </Link>
            </>
          ) : (
            <>
              Esta sucursal no tiene el recojo activado.{" "}
              <Link href={`/t/${slug}/sucursales/${sucursal.id}`} className="font-semibold underline">
                Activarlo en la sucursal
              </Link>
            </>
          )}
        </p>
      ) : null}

      {entrega === "delivery" ? (
        <>
          <MapaCliente
            lat={punto?.lat ?? null}
            lng={punto?.lng ?? null}
            miUbicacion={false}
            onMove={(lat, lng) => setPunto({ lat, lng })}
          />
          {habilitada ? (
            <div aria-live="polite" className="text-sm">
              {calculando ? <InlineLoader>Calculando envío…</InlineLoader> : null}
              {envioError ? <p className="text-[var(--er)]">{envioError}</p> : null}
              {envio && !calculando ? (
                <p className="tabular-nums text-[var(--mu)]">
                  Distancia {envio.distanciaKm} km · envío {formatoBs(envio.costo)}
                </p>
              ) : null}
            </div>
          ) : null}
          <Campo id="venta-direccion" etiqueta="Dirección y referencia">
            <input
              id="venta-direccion"
              required
              minLength={4}
              autoComplete="off"
              value={direccion}
              onChange={(event) => setDireccion(capitalizar(event.target.value))}
              className={claseCampo}
            />
          </Campo>
        </>
      ) : habilitada ? (
        <p className="text-sm text-[var(--mu)]">Recoge en la sucursal, lo antes posible.</p>
      ) : null}

      <Campo id="venta-nombre" etiqueta={entrega === "delivery" ? "Nombre" : "Nombre (opcional)"}>
        <input
          id="venta-nombre"
          required={entrega === "delivery"}
          minLength={2}
          maxLength={80}
          autoComplete="off"
          value={nombre}
          onChange={(event) => setNombre(capitalizar(event.target.value))}
          className={claseCampo}
        />
      </Campo>
      <Campo id="venta-telefono" etiqueta={entrega === "delivery" ? "Celular" : "Celular (opcional)"}>
        <input
          id="venta-telefono"
          type="tel"
          inputMode="tel"
          required={entrega === "delivery"}
          autoComplete="off"
          placeholder="7XXXXXXX"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          className={claseCampo}
        />
      </Campo>

      <SegmentedControl
        etiqueta="Método de pago"
        valor={pago}
        opciones={METODOS_PAGO.map((metodo) => ({ valor: metodo, etiqueta: etiquetaMetodoPago(metodo) }))}
        onChange={setPago}
      />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--mu)]">Subtotal</dt>
          <dd className="font-semibold tabular-nums">{formatoBs(subtotal)}</dd>
        </div>
        {entrega === "delivery" ? (
          <div className="flex justify-between">
            <dt className="text-[var(--mu)]">Envío</dt>
            <dd className="font-semibold tabular-nums">{costoEnvio == null ? "—" : formatoBs(costoEnvio)}</dd>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-[17px] font-extrabold tabular-nums">
            {formatoBs(subtotal + (costoEnvio ?? 0))}
          </dd>
        </div>
      </dl>

      {accion.error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {accion.error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        loading={accion.loading}
        loadingLabel="Enviando pedido…"
        disabled={!listo}
      >
        {habilitada && entrega === "delivery" && !envio ? "Ubica la entrega en el mapa" : "Confirmar pedido"}
      </Button>
    </form>
  );
}
