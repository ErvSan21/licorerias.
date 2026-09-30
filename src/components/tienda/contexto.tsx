"use client";

import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { reconciliarCarrito, type AvisoCarrito, type LineaGuardada } from "@/lib/tienda/reglas";
import type { ProductoPublico, Vitrina } from "@/lib/tienda/servicio";

type Linea = { productoId: string; cantidad: number };
type Entrega = "delivery" | "recojo";

type Estado = {
  busqueda: string;
  categoriaId: string | null;
  lineas: Linea[];
  avisos: AvisoCarrito[];
  entrega: Entrega | null;
  checkout: boolean;
  detalleId: string | null;
  pulso: number;
  envio: { distanciaKm: number; costo: number } | null;
  envioError: string | null;
  envioCargando: boolean;
  puedeConfirmar: boolean;
  cantidad: number;
  total: number;
};

type Acciones = {
  setBusqueda: (valor: string) => void;
  setCategoria: (id: string | null) => void;
  agregar: (productoId: string) => void;
  cambiarCantidad: (productoId: string, cantidad: number) => void;
  abrirCheckout: () => void;
  cerrarCheckout: () => void;
  abrirDetalle: (productoId: string) => void;
  cerrarDetalle: () => void;
  setEntrega: (entrega: Entrega) => void;
  setEnvio: (envio: { distanciaKm: number; costo: number } | null, error: string | null, cargando: boolean) => void;
  confirmar: (datos: DatosPedido) => Promise<string>;
};

export type DatosPedido = {
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string;
  lat: number | null;
  lng: number | null;
  horaRecojo: string | null;
  metodoPago: "efectivo" | "qr";
};

type Meta = { vitrina: Vitrina; productos: Map<string, ProductoPublico> };

const Contexto = createContext<{ estado: Estado; acciones: Acciones; meta: Meta } | null>(null);

export function useTienda() {
  const valor = use(Contexto);
  if (!valor) throw new Error("La tienda no está disponible en este componente.");
  return valor;
}

export function TiendaProvider({
  vitrina,
  children,
}: {
  vitrina: Vitrina;
  children: ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoria] = useState<string | null>(null);
  const [editadas, setEditadas] = useState<Linea[] | null>(null);
  const [elegida, setElegida] = useState<Entrega | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [pulso, setPulso] = useState(0);
  const [envio, setEnvioEstado] = useState<{ distanciaKm: number; costo: number } | null>(null);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [envioCargando, setEnvioCargando] = useState(false);
  const crudo = useSyncExternalStore(
    suscribir,
    () => leerCrudo(vitrina.tienda.slug),
    () => "",
  );
  const base = useMemo(
    () => reconciliarCarrito(parseCarrito(crudo), vitrina.productos),
    [crudo, vitrina.productos],
  );
  const lineas = editadas ?? base.lineas;
  const avisos = editadas ? [] : base.avisos;

  const productos = useMemo(() => new Map(vitrina.productos.map((producto) => [producto.id, producto])), [vitrina.productos]);
  const entrega = elegida ?? entregaUnica(vitrina);
  const primerGuardado = useRef(true);

  useEffect(() => {
    if (primerGuardado.current) {
      primerGuardado.current = false;
      return;
    }
    guardarCarrito(vitrina.tienda.slug, lineas, productos);
  }, [lineas, productos, vitrina.tienda.slug]);

  const total = lineas.reduce((suma, linea) => suma + (productos.get(linea.productoId)?.precioFinal ?? 0) * linea.cantidad, 0);
  const cantidad = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  const entregaDisponible =
    entrega === "recojo" ? vitrina.sucursal.aceptaRecojo : entrega === "delivery" ? vitrina.sucursal.aceptaDelivery : false;
  const puedeConfirmar =
    vitrina.sucursal.abiertaAhora &&
    lineas.length > 0 &&
    entregaDisponible &&
    (entrega === "recojo" || (envio != null && !envioError && !envioCargando));

  const acciones: Acciones = {
    setBusqueda,
    setCategoria,
    agregar(productoId) {
      const producto = productos.get(productoId);
      if (!producto || producto.agotado) return;
      setEditadas((prev) => {
        const origen = prev ?? lineas;
        const actual = origen.find((linea) => linea.productoId === productoId);
        if (!actual) return [...origen, { productoId, cantidad: 1 }];
        return origen.map((linea) =>
          linea.productoId === productoId ? { ...linea, cantidad: Math.min(99, linea.cantidad + 1) } : linea,
        );
      });
      setPulso((valor) => valor + 1);
    },
    cambiarCantidad(productoId, cantidadNueva) {
      setEditadas((prev) => {
        const origen = prev ?? lineas;
        if (cantidadNueva <= 0) return origen.filter((linea) => linea.productoId !== productoId);
        return origen.map((linea) =>
          linea.productoId === productoId ? { ...linea, cantidad: Math.min(99, cantidadNueva) } : linea,
        );
      });
    },
    abrirCheckout() {
      setCheckout(true);
    },
    cerrarCheckout() {
      setCheckout(false);
    },
    abrirDetalle(productoId) {
      setDetalleId(productoId);
    },
    cerrarDetalle() {
      setDetalleId(null);
    },
    setEntrega(siguiente) {
      setElegida(siguiente);
      setEnvioEstado(null);
      setEnvioError(null);
    },
    setEnvio(siguiente, error, cargando) {
      setEnvioEstado(siguiente);
      setEnvioError(error);
      setEnvioCargando(cargando);
    },
    async confirmar(datos) {
      if (!entrega) throw new Error("Elige delivery o recojo.");
      const respuesta = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sucursalId: vitrina.sucursal.id,
          nombre: datos.nombre,
          telefono: datos.telefono,
          tipo: entrega,
          lat: entrega === "delivery" ? datos.lat : null,
          lng: entrega === "delivery" ? datos.lng : null,
          direccion: entrega === "delivery" ? datos.direccion : "",
          referencia: entrega === "delivery" ? datos.referencia : "",
          horaRecojo: entrega === "recojo" ? datos.horaRecojo : null,
          metodoPago: datos.metodoPago,
          items: lineas.map((linea) => ({ productoId: linea.productoId, cantidad: linea.cantidad })),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!respuesta.ok || !cuerpo?.id) {
        throw new Error(cuerpo?.error || "No se pudo completar. Inténtalo de nuevo.");
      }
      setEditadas([]);
      borrarCarrito(vitrina.tienda.slug);
      return cuerpo.id;
    },
  };

  const estado: Estado = {
    busqueda,
    categoriaId,
    lineas,
    avisos,
    entrega,
    checkout,
    detalleId,
    pulso,
    envio,
    envioError,
    envioCargando,
    puedeConfirmar,
    cantidad,
    total,
  };

  return <Contexto value={{ estado, acciones, meta: { vitrina, productos } }}>{children}</Contexto>;
}

/** Recojo en tienda primero; delivery solo si es lo único que acepta la sucursal. */
function entregaUnica(vitrina: Vitrina): Entrega | null {
  const { aceptaDelivery, aceptaRecojo } = vitrina.sucursal;
  if (aceptaRecojo) return "recojo";
  if (aceptaDelivery) return "delivery";
  return null;
}

function suscribir() {
  return () => undefined;
}

function clave(slug: string) {
  return `lic-carrito:v1:${slug}`;
}

function leerCrudo(slug: string): string {
  try {
    return sessionStorage.getItem(clave(slug)) ?? "";
  } catch {
    return "";
  }
}

function parseCarrito(crudo: string): LineaGuardada[] {
  if (!crudo) return [];
  try {
    const datos = JSON.parse(crudo) as { lineas?: LineaGuardada[] };
    if (!Array.isArray(datos.lineas)) return [];
    return datos.lineas.flatMap((linea) => {
      if (!linea || typeof linea.productoId !== "string") return [];
      return [{ productoId: linea.productoId, cantidad: Number(linea.cantidad) || 1, precioFinal: Number(linea.precioFinal) }];
    });
  } catch {
    return [];
  }
}

function guardarCarrito(slug: string, lineas: Linea[], productos: Map<string, ProductoPublico>) {
  try {
    const guardadas = lineas.flatMap((linea) => {
      const producto = productos.get(linea.productoId);
      if (!producto) return [];
      return [{ productoId: linea.productoId, cantidad: linea.cantidad, precioFinal: producto.precioFinal }];
    });
    const texto = JSON.stringify({ lineas: guardadas });
    if (sessionStorage.getItem(clave(slug)) !== texto) sessionStorage.setItem(clave(slug), texto);
  } catch {
    // El carrito sigue en memoria si el navegador bloquea el almacenamiento.
  }
}

function borrarCarrito(slug: string) {
  try {
    sessionStorage.removeItem(clave(slug));
  } catch {
    // Nada que limpiar.
  }
}
