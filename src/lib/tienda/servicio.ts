import "server-only";

import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { createServiceClient } from "@/lib/supabase/service";

import { resolveTenantBySlug } from "@/lib/auth/panel";
import { leerMarcaPublica, leerQrPago } from "@/lib/marca/servicio";
import type { MarcaPublica } from "@/lib/marca/reglas";
import type { Horario } from "@/lib/sucursales/reglas";

import { horarioDesdeJson } from "./reglas";

export class TiendaCerrada extends Error {
  constructor() {
    super("Tienda no disponible.");
    this.name = "TiendaCerrada";
  }
}

export type SucursalPublica = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  abierta: boolean;
  abiertaAhora: boolean;
  aceptaDelivery: boolean;
  aceptaRecojo: boolean;
};

export type Escaparate = {
  nombre: string;
  slug: string;
  sucursales: SucursalPublica[];
  marca: MarcaPublica;
};

export type ProductoPublico = {
  id: string;
  nombre: string;
  descripcion: string;
  categoriaId: string | null;
  imagenUrl: string | null;
  precioOriginal: number;
  precioFinal: number;
  origen: string;
  agotado: boolean;
};

export type Vitrina = {
  marca: MarcaPublica;
  /** Imagen del QR de cobro; null si la tienda no lo cargó. */
  qrPagoUrl: string | null;
  tienda: { nombre: string; slug: string };
  sucursal: {
    id: string;
    slug: string;
    nombre: string;
    direccion: string;
    lat: number | null;
    lng: number | null;
    abiertaAhora: boolean;
    aceptaDelivery: boolean;
    aceptaRecojo: boolean;
    minutosRecojo: number;
    horario: Horario;
  };
  categorias: { id: string; nombre: string }[];
  productos: ProductoPublico[];
  colecciones: { id: string; nombre: string; imagenUrl: string | null; productoIds: string[] }[];
};

export async function cargarEscaparate(slug: string): Promise<Escaparate> {
  const service = createServiceClient();
  const rpcPromise = service.rpc("escaparate", { p_slug: slug });
  const marcaPromise = leerMarcaPublica(slug);
  const { data, error } = await rpcPromise;
  if (error) lanzar(error.message);
  const marca = await marcaDe(marcaPromise);
  const fila = data as { nombre?: unknown; slug?: unknown; sucursales?: unknown } | null;
  if (!fila || typeof fila.nombre !== "string") throw new NoEncontrado();
  const sucursales = Array.isArray(fila.sucursales) ? fila.sucursales.flatMap(sucursalPublica) : [];
  return { nombre: fila.nombre, slug: String(fila.slug ?? slug), sucursales, marca };
}

export async function cargarVitrina(tienda: string, sucursal: string): Promise<Vitrina> {
  const service = createServiceClient();
  const rpcPromise = service.rpc("vitrina_publica", { p_tienda: tienda, p_sucursal: sucursal });
  const marcaPromise = leerMarcaPublica(tienda);
  const qrPromise = resolveTenantBySlug(tienda)
    .then((fila) => (fila ? leerQrPago(fila.id) : null))
    .catch(() => null);
  const { data, error } = await rpcPromise;
  if (error) lanzar(error.message);
  const [marca, qrPagoUrl] = await Promise.all([marcaDe(marcaPromise), qrPromise]);
  return { ...vitrinaDesdeJson(data), marca, qrPagoUrl };
}

async function marcaDe(promesa: Promise<MarcaPublica>): Promise<MarcaPublica> {
  try {
    return await promesa;
  } catch (error) {
    lanzar(error instanceof Error ? error.message : "No se pudo cargar la marca.");
  }
}

function sucursalPublica(valor: unknown): SucursalPublica[] {
  if (!valor || typeof valor !== "object") return [];
  const fila = valor as Record<string, unknown>;
  if (typeof fila.id !== "string" || typeof fila.slug !== "string" || typeof fila.nombre !== "string") return [];
  return [
    {
      id: fila.id,
      slug: fila.slug,
      nombre: fila.nombre,
      direccion: String(fila.direccion ?? ""),
      lat: numeroONulo(fila.lat),
      lng: numeroONulo(fila.lng),
      abierta: fila.abierta === true,
      abiertaAhora: fila.abiertaAhora === true,
      aceptaDelivery: fila.aceptaDelivery === true,
      aceptaRecojo: fila.aceptaRecojo === true,
    },
  ];
}

function vitrinaDesdeJson(data: unknown): Omit<Vitrina, "marca" | "qrPagoUrl"> {
  const fila = data as {
    tienda?: { nombre?: unknown; slug?: unknown };
    sucursal?: Record<string, unknown>;
    categorias?: unknown;
    productos?: unknown;
    colecciones?: unknown;
  } | null;
  const sucursal = fila?.sucursal;
  if (!fila?.tienda || typeof fila.tienda.nombre !== "string" || !sucursal || typeof sucursal.id !== "string") {
    throw new NoEncontrado();
  }
  return {
    tienda: { nombre: fila.tienda.nombre, slug: String(fila.tienda.slug ?? "") },
    sucursal: {
      id: String(sucursal.id),
      slug: String(sucursal.slug ?? ""),
      nombre: String(sucursal.nombre ?? ""),
      direccion: String(sucursal.direccion ?? ""),
      lat: numeroONulo(sucursal.lat),
      lng: numeroONulo(sucursal.lng),
      abiertaAhora: sucursal.abiertaAhora === true,
      aceptaDelivery: sucursal.aceptaDelivery === true,
      aceptaRecojo: sucursal.aceptaRecojo === true,
      minutosRecojo: Number(sucursal.minutosRecojo ?? 30),
      horario: horarioDesdeJson(sucursal.horario),
    },
    categorias: Array.isArray(fila.categorias)
      ? fila.categorias.flatMap((item) => {
          const categoria = item as { id?: unknown; nombre?: unknown };
          if (typeof categoria.id !== "string" || typeof categoria.nombre !== "string") return [];
          return [{ id: categoria.id, nombre: categoria.nombre }];
        })
      : [],
    productos: Array.isArray(fila.productos) ? fila.productos.flatMap(productoPublico) : [],
    colecciones: Array.isArray(fila.colecciones)
      ? fila.colecciones.flatMap((item) => {
          const coleccion = item as { id?: unknown; nombre?: unknown; imagenUrl?: unknown; productoIds?: unknown };
          if (typeof coleccion.id !== "string" || typeof coleccion.nombre !== "string") return [];
          const productoIds = Array.isArray(coleccion.productoIds)
            ? coleccion.productoIds.filter((id): id is string => typeof id === "string")
            : [];
          return [
            {
              id: coleccion.id,
              nombre: coleccion.nombre,
              imagenUrl: typeof coleccion.imagenUrl === "string" ? coleccion.imagenUrl : null,
              productoIds,
            },
          ];
        })
      : [],
  };
}

function productoPublico(valor: unknown): ProductoPublico[] {
  if (!valor || typeof valor !== "object") return [];
  const fila = valor as Record<string, unknown>;
  if (typeof fila.id !== "string" || typeof fila.nombre !== "string") return [];
  const precioFinal = Number(fila.precioFinal);
  const precioOriginal = Number(fila.precioOriginal);
  if (!Number.isFinite(precioFinal) || !Number.isFinite(precioOriginal)) return [];
  return [
    {
      id: fila.id,
      nombre: fila.nombre,
      descripcion: typeof fila.descripcion === "string" ? fila.descripcion : "",
      categoriaId: typeof fila.categoriaId === "string" ? fila.categoriaId : null,
      imagenUrl: typeof fila.imagenUrl === "string" ? fila.imagenUrl : null,
      precioOriginal,
      precioFinal,
      origen: typeof fila.origen === "string" ? fila.origen : "central",
      agotado: fila.agotado === true,
    },
  ];
}

function numeroONulo(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function lanzar(mensaje: string): never {
  if (mensaje.includes("no encontrada")) throw new NoEncontrado();
  if (mensaje.includes("no disponible")) throw new TiendaCerrada();
  if (mensaje.includes("configuracion") || mensaje.includes("Invalid API")) throw new AccesoError("configuracion");
  throw new Error(mensaje);
}
