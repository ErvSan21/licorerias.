import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { esUuid } from "@/lib/licencias/reglas";
import { createServiceClient } from "@/lib/supabase/service";
import { ROLES_TIENDA, type RolTienda } from "@/lib/tenant";

import {
  aTimestamptzBolivia,
  estadoOferta,
  NegocioError,
  parseDescripcionColeccion,
  parseNombreColeccion,
  parseTipoOferta,
  parseValorOferta,
  rangoValido,
  type EstadoOferta,
  type OrigenPrecio,
  type TipoOferta,
} from "./reglas";

const ESCRITURA = ["dueno", "gerente"] as const;

export type OfertaLista = {
  id: string;
  productoId: string;
  producto: string;
  sucursalId: string | null;
  sucursal: string | null;
  tipo: TipoOferta;
  valor: number;
  inicio: string;
  fin: string;
  activa: boolean;
  estado: EstadoOferta;
};

export type ColeccionLista = {
  id: string;
  nombre: string;
  descripcion: string;
  imagenUrl: string | null;
  inicio: string;
  fin: string;
  activa: boolean;
  estado: EstadoOferta;
  productoIds: string[];
};

export type PrecioVigente = {
  precioOriginal: number;
  precioFinal: number;
  origen: OrigenPrecio;
};

export type DisponibilidadOferta = { productoId: string; sucursalId: string };

export async function listarOfertas(slug: string): Promise<{
  ofertas: OfertaLista[];
  productos: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
  disponibilidad: DisponibilidadOferta[];
}> {
  const { tienda, staff } = await exigir(slug, null, ROLES_TIENDA);
  const permitidas = await sucursalesPermitidas(staff.miembroId, staff.rol, tienda.id);
  const service = createServiceClient();
  const [ofertasRes, productosRes, sucursalesRes, disponibilidadRes] = await Promise.all([
    service
      .from("ofertas")
      .select("id, tienda_id, producto_id, sucursal_id, tipo, valor, inicio, fin, activa")
      .eq("tienda_id", tienda.id)
      .order("inicio", { ascending: false }),
    service.from("productos").select("id, nombre, activo").eq("tienda_id", tienda.id).order("nombre"),
    service.from("sucursales").select("id, nombre").eq("tienda_id", tienda.id).order("nombre"),
    service.from("producto_sucursal").select("producto_id, sucursal_id").eq("tienda_id", tienda.id),
  ]);
  if (ofertasRes.error) throw new Error(ofertasRes.error.message);
  if (productosRes.error) throw new Error(productosRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);
  if (disponibilidadRes.error) throw new Error(disponibilidadRes.error.message);

  const productos = ((productosRes.data ?? []) as { id: string; nombre: string; activo: boolean }[])
    .filter((fila) => fila.activo)
    .map((fila) => ({ id: fila.id, nombre: fila.nombre }));
  const nombresProducto = new Map(productos.map((producto) => [producto.id, producto.nombre]));
  const sucursales = ((sucursalesRes.data ?? []) as { id: string; nombre: string }[]).filter((fila) =>
    permitidas.has(fila.id),
  );
  const nombresSucursal = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));

  const ofertas = ((ofertasRes.data ?? []) as FilaOferta[]).flatMap((fila) => {
    if (fila.tienda_id !== tienda.id) return [];
    if (fila.sucursal_id && !permitidas.has(fila.sucursal_id)) return [];
    if (!nombresProducto.has(fila.producto_id) && staff.rol !== "dueno") return [];
    return [
      {
        id: fila.id,
        productoId: fila.producto_id,
        producto: nombresProducto.get(fila.producto_id) ?? "Producto",
        sucursalId: fila.sucursal_id,
        sucursal: fila.sucursal_id ? (nombresSucursal.get(fila.sucursal_id) ?? null) : null,
        tipo: fila.tipo === "precio_fijo" ? "precio_fijo" : "porcentaje",
        valor: numero(fila.valor),
        inicio: fila.inicio,
        fin: fila.fin,
        activa: fila.activa,
        estado: estadoOferta({ inicio: fila.inicio, fin: fila.fin, activa: fila.activa }),
      } satisfies OfertaLista,
    ];
  });

  const disponibilidad = ((disponibilidadRes.data ?? []) as { producto_id: string; sucursal_id: string }[])
    .filter((fila) => permitidas.has(fila.sucursal_id))
    .map((fila) => ({ productoId: fila.producto_id, sucursalId: fila.sucursal_id }));

  return { ofertas, productos, sucursales, disponibilidad };
}

export async function guardarOferta(
  slug: string,
  input: {
    id: string | null;
    productoId: string;
    sucursalId: string | null;
    tipo: TipoOferta;
    valor: number;
    inicio: string;
    fin: string;
    activa: boolean;
  },
): Promise<string> {
  if (input.tipo === "precio_fijo" && !input.sucursalId) {
    throw new NegocioError("El precio fijo es de una sucursal.");
  }
  const roles: readonly RolTienda[] = input.sucursalId ? ESCRITURA : ["dueno"];
  const { tienda, staff } = await exigir(slug, input.sucursalId, roles);
  await exigirLicenciaParaEscribir(tienda.id);
  if (staff.rol !== "dueno" && !input.sucursalId) {
    throw new NegocioError("Elige la sucursal de la oferta.");
  }
  const sucursal = input.sucursalId;
  const service = createServiceClient();
  const { data, error } = await service.rpc("guardar_oferta", {
    p_tienda: tienda.id,
    p_oferta: input.id,
    p_producto: input.productoId,
    p_sucursal: sucursal,
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_inicio: input.inicio,
    p_fin: input.fin,
    p_activa: input.activa,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  if (typeof data !== "string") throw new Error("No se guardó la oferta.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: input.id ? "oferta.edicion" : "oferta.alta",
    detalle: { oferta_id: data, producto_id: input.productoId, sucursal_id: sucursal, tipo: input.tipo },
  });
  return data;
}

export function ofertaDesdeFormulario(datos: FormData) {
  const tipo = parseTipoOferta(datos.get("tipo"));
  const sucursal = String(datos.get("sucursalId") ?? "");
  const inicio = aTimestamptzBolivia(String(datos.get("inicio") ?? ""));
  const fin = aTimestamptzBolivia(String(datos.get("fin") ?? ""));
  rangoValido(inicio, fin);
  const id = String(datos.get("id") ?? "");
  return {
    id: id ? uuid(id, "Oferta no encontrada.") : null,
    productoId: uuid(datos.get("productoId"), "El producto no pertenece a la tienda."),
    sucursalId: sucursal ? uuid(sucursal, "La sucursal no pertenece a la tienda.") : null,
    tipo,
    valor: parseValorOferta(tipo, datos.get("valor")),
    inicio,
    fin,
    activa: datos.get("activa") === "on",
  };
}

export async function listarColecciones(slug: string): Promise<{
  colecciones: ColeccionLista[];
  productos: { id: string; nombre: string }[];
}> {
  const { tienda } = await exigir(slug, null, ROLES_TIENDA);
  const service = createServiceClient();
  const [coleccionesRes, miembrosRes, productosRes] = await Promise.all([
    service
      .from("colecciones")
      .select("id, tienda_id, nombre, descripcion, imagen_url, inicio, fin, activa")
      .eq("tienda_id", tienda.id)
      .order("inicio", { ascending: false }),
    service.from("coleccion_productos").select("coleccion_id, producto_id, orden").eq("tienda_id", tienda.id),
    service.from("productos").select("id, nombre").eq("tienda_id", tienda.id).eq("activo", true).order("nombre"),
  ]);
  if (coleccionesRes.error) throw new Error(coleccionesRes.error.message);
  if (miembrosRes.error) throw new Error(miembrosRes.error.message);
  if (productosRes.error) throw new Error(productosRes.error.message);

  const porColeccion = new Map<string, { productoId: string; orden: number }[]>();
  for (const fila of (miembrosRes.data ?? []) as { coleccion_id: string; producto_id: string; orden: number }[]) {
    const lista = porColeccion.get(fila.coleccion_id) ?? [];
    lista.push({ productoId: fila.producto_id, orden: fila.orden });
    porColeccion.set(fila.coleccion_id, lista);
  }

  const colecciones = ((coleccionesRes.data ?? []) as FilaColeccion[])
    .filter((fila) => fila.tienda_id === tienda.id)
    .map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? "",
      imagenUrl: fila.imagen_url,
      inicio: fila.inicio,
      fin: fila.fin,
      activa: fila.activa,
      estado: estadoOferta({ inicio: fila.inicio, fin: fila.fin, activa: fila.activa }),
      productoIds: (porColeccion.get(fila.id) ?? [])
        .toSorted((a, b) => a.orden - b.orden)
        .map((item) => item.productoId),
    }));

  return {
    colecciones,
    productos: (productosRes.data ?? []) as { id: string; nombre: string }[],
  };
}

export async function guardarColeccion(
  slug: string,
  input: {
    id: string | null;
    nombre: string;
    descripcion: string;
    inicio: string;
    fin: string;
    activa: boolean;
    productoIds: string[];
  },
): Promise<string> {
  const { tienda, staff } = await exigir(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  const service = createServiceClient();
  const { data, error } = await service.rpc("guardar_coleccion", {
    p_tienda: tienda.id,
    p_coleccion: input.id,
    p_nombre: input.nombre,
    p_descripcion: input.descripcion,
    p_inicio: input.inicio,
    p_fin: input.fin,
    p_activa: input.activa,
    p_productos: input.productoIds,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  if (typeof data !== "string") throw new Error("No se guardó la colección.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: input.id ? "coleccion.edicion" : "coleccion.alta",
    detalle: { coleccion_id: data, productos: input.productoIds.length },
  });
  return data;
}

export async function guardarImagenColeccion(slug: string, coleccionId: string, imagen: {
  bytes: Uint8Array;
  tipo: string;
}): Promise<void> {
  const { tienda, staff } = await exigir(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(coleccionId)) throw new NoEncontrado();
  const extension = imagen.tipo === "image/png" ? "png" : imagen.tipo === "image/webp" ? "webp" : "jpg";
  const ruta = `${tienda.id}/colecciones/${coleccionId}.${extension}`;
  const service = createServiceClient();
  const { error } = await service.storage.from("productos").upload(ruta, imagen.bytes, {
    contentType: imagen.tipo,
    upsert: true,
  });
  if (error) throw new NegocioError("No se pudo guardar la imagen.");
  const publica = service.storage.from("productos").getPublicUrl(ruta);
  const { error: actualizacion } = await service
    .from("colecciones")
    .update({ imagen_url: publica.data.publicUrl })
    .eq("id", coleccionId)
    .eq("tienda_id", tienda.id);
  if (actualizacion) throw new Error(actualizacion.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "coleccion.imagen",
    detalle: { coleccion_id: coleccionId },
  });
}

export function coleccionDesdeFormulario(datos: FormData) {
  const inicio = aTimestamptzBolivia(String(datos.get("inicio") ?? ""));
  const fin = aTimestamptzBolivia(String(datos.get("fin") ?? ""));
  rangoValido(inicio, fin);
  const id = String(datos.get("id") ?? "");
  const productoIds = [...new Set(datos.getAll("producto").map((valor) => String(valor)))];
  return {
    id: id ? uuid(id, "Colección no encontrada.") : null,
    nombre: parseNombreColeccion(datos.get("nombre")),
    descripcion: parseDescripcionColeccion(datos.get("descripcion")),
    inicio,
    fin,
    activa: datos.get("activa") === "on",
    productoIds: productoIds.map((producto) => uuid(producto, "El producto no pertenece a la tienda.")),
  };
}

export async function consultarPrecioVigente(
  slug: string,
  productoId: string,
  sucursalId: string,
): Promise<PrecioVigente | null> {
  const { tienda } = await exigir(slug, sucursalId, ROLES_TIENDA);
  if (!esUuid(productoId)) throw new NoEncontrado();
  const service = createServiceClient();
  const { data: producto, error: errorProducto } = await service
    .from("productos")
    .select("id")
    .eq("id", productoId)
    .eq("tienda_id", tienda.id)
    .maybeSingle();
  if (errorProducto) throw new Error(errorProducto.message);
  if (!producto) throw new NoEncontrado();
  const { data, error } = await service.rpc("precio_vigente", {
    p_producto: productoId,
    p_sucursal: sucursalId,
  });
  if (error) lanzar(error.message);
  if (!data || typeof data !== "object") return null;
  const fila = data as { precio_original: number; precio_final: number; origen_precio: string };
  if (fila.origen_precio !== "central" && fila.origen_precio !== "propio" && fila.origen_precio !== "oferta") {
    return null;
  }
  return {
    precioOriginal: numero(fila.precio_original),
    precioFinal: numero(fila.precio_final),
    origen: fila.origen_precio,
  };
}

async function exigir(slug: string, sucursalId: string | null, roles: readonly RolTienda[]) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId, roles });
  return { tienda, staff };
}

async function sucursalesPermitidas(miembroId: string, rol: RolTienda, tiendaId: string) {
  const service = createServiceClient();
  if (rol === "dueno") {
    const { data, error } = await service.from("sucursales").select("id").eq("tienda_id", tiendaId);
    if (error) throw new Error(error.message);
    return new Set(((data ?? []) as { id: string }[]).map((fila) => fila.id));
  }
  const { data, error } = await service
    .from("miembro_sucursales")
    .select("sucursal_id")
    .eq("miembro_id", miembroId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { sucursal_id: string }[]).map((fila) => fila.sucursal_id));
}

function uuid(valor: unknown, mensaje: string): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError(mensaje);
  return id;
}

function numero(valor: number | string): number {
  const convertido = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(convertido)) throw new Error("Precio inválido.");
  return convertido;
}

function lanzar(mensaje: string): never {
  const conocidos = [
    "El tipo de oferta no es válido.",
    "El precio fijo es de una sucursal.",
    "El valor de la oferta no puede ser negativo.",
    "El porcentaje no puede pasar de 100.",
    "La fecha de fin tiene que ser posterior al inicio.",
    "El producto no pertenece a la tienda.",
    "La sucursal no pertenece a la tienda.",
    "El producto no se ofrece en esa sucursal.",
    "Oferta no encontrada.",
    "Escribe el nombre de la colección.",
    "Colección no encontrada.",
    "Elige la sucursal de la oferta.",
  ];
  for (const texto of conocidos) {
    if (mensaje.includes(texto)) {
      if (texto === "Oferta no encontrada." || texto === "Colección no encontrada.") throw new NoEncontrado();
      throw new NegocioError(texto);
    }
  }
  throw new Error(mensaje);
}

type FilaOferta = {
  id: string;
  tienda_id: string;
  producto_id: string;
  sucursal_id: string | null;
  tipo: string;
  valor: number | string;
  inicio: string;
  fin: string;
  activa: boolean;
};

type FilaColeccion = {
  id: string;
  tienda_id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  inicio: string;
  fin: string;
  activa: boolean;
};
