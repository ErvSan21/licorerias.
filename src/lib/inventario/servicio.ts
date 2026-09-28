import "server-only";

import { cache } from "react";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/staff";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { createServiceClient } from "@/lib/supabase/service";
import { ROLES_TIENDA, type RolTienda } from "@/lib/tenant";

import {
  csvAFilas,
  filasACsv,
  parseCantidad,
  parseMotivo,
  type FilaInventario,
} from "./reglas";

const ROLES_ESCRITURA = ["dueno", "gerente"] as const;

type FilaProducto = {
  id: string;
  tienda_id: string;
  nombre: string;
  categoria_id: string | null;
  activo: boolean;
};

type FilaSucursal = {
  id: string;
  nombre: string;
  slug: string;
  activa: boolean;
};

type FilaStock = {
  producto_id: string;
  sucursal_id: string;
  stock: number;
  stock_minimo: number;
  disponible: boolean;
};

export type Inventario = {
  filas: FilaInventario[];
  sucursales: { id: string; nombre: string; slug: string }[];
};

export type MovimientoInventario = {
  id: string;
  sucursalId: string;
  sucursal: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  creadoEn: string;
};

export async function listarInventario(slug: string, sucursalId: string | null = null): Promise<Inventario> {
  const { tienda, staff } = await exigirInventario(slug, sucursalId, ROLES_TIENDA);
  const service = createServiceClient();
  const [productosRes, categoriasRes, stockRes, sucursalesRes, asignadas] = await Promise.all([
    service
      .from("productos")
      .select("id, tienda_id, nombre, categoria_id, activo")
      .eq("tienda_id", tienda.id),
    service.from("categorias").select("id, nombre").eq("tienda_id", tienda.id),
    service
      .from("producto_sucursal")
      .select("producto_id, sucursal_id, stock, stock_minimo, disponible")
      .eq("tienda_id", tienda.id),
    service.from("sucursales").select("id, nombre, slug, activa").eq("tienda_id", tienda.id),
    staff.rol === "dueno"
      ? Promise.resolve(null)
      : service.from("miembro_sucursales").select("sucursal_id").eq("miembro_id", staff.miembroId),
  ]);

  if (productosRes.error) throw new Error(productosRes.error.message);
  if (categoriasRes.error) throw new Error(categoriasRes.error.message);
  if (stockRes.error) throw new Error(stockRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);
  if (asignadas && asignadas.error) throw new Error(asignadas.error.message);

  const permitidas = new Set(
    staff.rol === "dueno"
      ? ((sucursalesRes.data ?? []) as FilaSucursal[]).map((fila) => fila.id)
      : ((asignadas?.data ?? []) as { sucursal_id: string }[]).map((fila) => fila.sucursal_id),
  );
  if (sucursalId && !permitidas.has(sucursalId)) throw new NoEncontrado();

  const sucursales = ((sucursalesRes.data ?? []) as FilaSucursal[])
    .filter((fila) => permitidas.has(fila.id))
    .map((fila) => ({ id: fila.id, nombre: fila.nombre, slug: fila.slug }));
  const porSucursal = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal]));
  const categorias = new Map(
    ((categoriasRes.data ?? []) as { id: string; nombre: string }[]).map((fila) => [fila.id, fila.nombre]),
  );
  const productos = new Map(
    ((productosRes.data ?? []) as FilaProducto[])
      .filter((fila) => fila.tienda_id === tienda.id)
      .map((fila) => [fila.id, fila]),
  );

  const filas = ((stockRes.data ?? []) as FilaStock[]).flatMap((fila) => {
    if (!permitidas.has(fila.sucursal_id)) return [];
    if (sucursalId && fila.sucursal_id !== sucursalId) return [];
    const producto = productos.get(fila.producto_id);
    const sucursal = porSucursal.get(fila.sucursal_id);
    if (!producto || !sucursal) return [];
    return [
      {
        productoId: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria_id ? (categorias.get(producto.categoria_id) ?? "Sin categoría") : "Sin categoría",
        sucursalId: sucursal.id,
        sucursal: sucursal.nombre,
        sucursalSlug: sucursal.slug,
        stock: entero(fila.stock),
        stockMinimo: entero(fila.stock_minimo),
        disponible: fila.disponible,
        activo: producto.activo,
      },
    ];
  });

  return { filas, sucursales };
}

export const leerMovimientos = cache(async (slug: string, productoId: string, sucursalId: string | null) => {
  if (!esUuid(productoId)) throw new NoEncontrado();
  const inventario = await listarInventario(slug, sucursalId);
  const propias = inventario.filas.filter((fila) => fila.productoId === productoId);
  if (propias.length === 0) throw new NoEncontrado();
  const { tienda } = await exigirInventario(slug, sucursalId, ROLES_TIENDA);
  const service = createServiceClient();
  const consulta = service
    .from("movimientos_stock")
    .select("id, sucursal_id, tipo, cantidad, motivo, creado_en")
    .eq("tienda_id", tienda.id)
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: false })
    .limit(100);
  const { data, error } = sucursalId ? await consulta.eq("sucursal_id", sucursalId) : await consulta;
  if (error) throw new Error(error.message);

  const nombres = new Map(inventario.sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));
  const permitidas = new Set(inventario.sucursales.map((sucursal) => sucursal.id));
  const movimientos = ((data ?? []) as {
    id: string;
    sucursal_id: string;
    tipo: string;
    cantidad: number;
    motivo: string | null;
    creado_en: string;
  }[])
    .filter((fila) => permitidas.has(fila.sucursal_id))
    .map((fila) => ({
      id: fila.id,
      sucursalId: fila.sucursal_id,
      sucursal: nombres.get(fila.sucursal_id) ?? "Sucursal",
      tipo: fila.tipo,
      cantidad: entero(fila.cantidad),
      motivo: fila.motivo,
      creadoEn: fila.creado_en,
    }));

  return { producto: propias[0], filas: propias, movimientos };
});

export async function exportarCsv(slug: string, sucursalId: string | null): Promise<string> {
  const inventario = await listarInventario(slug, sucursalId);
  return filasACsv(inventario.filas);
}

export async function reponerStock(
  slug: string,
  input: { sucursalId: string; productoId: string; cantidad: number; motivo: string },
): Promise<number> {
  return mover(slug, { ...input, tipo: "entrada" });
}

export async function ajustarStockAbsoluto(
  slug: string,
  input: { sucursalId: string; productoId: string; stock: number; motivo: string },
): Promise<number> {
  return mover(slug, {
    sucursalId: input.sucursalId,
    productoId: input.productoId,
    cantidad: input.stock,
    motivo: input.motivo,
    tipo: "ajuste",
  });
}

export async function fijarMinimo(
  slug: string,
  input: { sucursalId: string; productoId: string; minimo: number },
): Promise<void> {
  const { tienda, staff } = await exigirInventario(slug, input.sucursalId, ROLES_ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  await productoDeLaTienda(tienda.id, input.productoId);
  const service = createServiceClient();
  const { error } = await service.rpc("fijar_stock_minimo", {
    p_sucursal: input.sucursalId,
    p_producto: input.productoId,
    p_minimo: input.minimo,
    p_user: staff.userId,
  });
  if (error) lanzarInventario(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "inventario.minimo",
    detalle: { producto_id: input.productoId, sucursal_id: input.sucursalId, minimo: input.minimo },
  });
}

export async function transferirStock(
  slug: string,
  input: { origenId: string; destinoId: string; productoId: string; cantidad: number },
): Promise<void> {
  const { tienda, staff } = await exigirInventario(slug, input.origenId, ROLES_ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  await exigirInventario(slug, input.destinoId, ROLES_ESCRITURA);
  await productoDeLaTienda(tienda.id, input.productoId);
  if (input.cantidad <= 0) throw new NegocioError("La cantidad tiene que ser mayor que cero.");
  const service = createServiceClient();
  const { error } = await service.rpc("transferir_stock", {
    p_origen: input.origenId,
    p_destino: input.destinoId,
    p_producto: input.productoId,
    p_cantidad: input.cantidad,
    p_user: staff.userId,
  });
  if (error) lanzarInventario(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "inventario.transferencia",
    detalle: {
      producto_id: input.productoId,
      origen_id: input.origenId,
      destino_id: input.destinoId,
      cantidad: input.cantidad,
    },
  });
}

export async function importarCsv(slug: string, texto: string): Promise<number> {
  if (texto.length > 1_000_000) throw new NegocioError("El archivo es demasiado grande.");
  const filas = csvAFilas(texto);
  const { tienda, staff } = await exigirInventario(slug, null, ROLES_ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  const inventario = await listarInventario(slug, null);
  const service = createServiceClient();
  const { data, error } = await service.rpc("importar_stock", {
    p_tienda: tienda.id,
    p_filas: filas.map((fila) => ({
      linea: fila.linea,
      sucursal: fila.sucursal,
      categoria: fila.categoria,
      producto: fila.producto,
      stock: fila.stock,
      stock_minimo: fila.stockMinimo,
    })),
    p_sucursales: inventario.sucursales.map((sucursal) => sucursal.id),
    p_user: staff.userId,
  });
  if (error) lanzarInventario(error.message);
  const aplicadas = typeof data === "number" ? data : Number(data);
  if (!Number.isInteger(aplicadas)) throw new Error("No se importó el stock.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "inventario.importacion",
    detalle: { filas: aplicadas },
  });
  return aplicadas;
}

export function reponerDesdeFormulario(datos: FormData) {
  return {
    sucursalId: uuid(datos.get("sucursalId")),
    productoId: uuid(datos.get("productoId")),
    cantidad: cantidadPositiva(datos.get("cantidad")),
    motivo: parseMotivo(datos.get("motivo")),
  };
}

export function ajusteDesdeFormulario(datos: FormData) {
  const cantidad = parseCantidad(datos.get("stock"), "el stock");
  return {
    sucursalId: uuid(datos.get("sucursalId")),
    productoId: uuid(datos.get("productoId")),
    stock: cantidad,
    motivo: parseMotivo(datos.get("motivo")),
  };
}

export function minimoDesdeFormulario(datos: FormData) {
  return {
    sucursalId: uuid(datos.get("sucursalId")),
    productoId: uuid(datos.get("productoId")),
    minimo: parseCantidad(datos.get("minimo"), "el stock mínimo"),
  };
}

export function transferenciaDesdeFormulario(datos: FormData) {
  return {
    origenId: uuid(datos.get("origenId")),
    destinoId: uuid(datos.get("destinoId")),
    productoId: uuid(datos.get("productoId")),
    cantidad: cantidadPositiva(datos.get("cantidad")),
  };
}

function cantidadPositiva(valor: unknown): number {
  const cantidad = parseCantidad(valor, "la cantidad");
  if (cantidad <= 0) throw new NegocioError("La cantidad tiene que ser mayor que cero.");
  return cantidad;
}

async function mover(
  slug: string,
  input: { sucursalId: string; productoId: string; cantidad: number; motivo: string; tipo: "entrada" | "ajuste" },
): Promise<number> {
  const { tienda, staff } = await exigirInventario(slug, input.sucursalId, ROLES_ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  await productoDeLaTienda(tienda.id, input.productoId);
  const service = createServiceClient();
  const { data, error } = await service.rpc("ajustar_stock", {
    p_sucursal: input.sucursalId,
    p_producto: input.productoId,
    p_cantidad: input.cantidad,
    p_tipo: input.tipo,
    p_motivo: input.motivo,
    p_user: staff.userId,
  });
  if (error) lanzarInventario(error.message);
  const stock = typeof data === "number" ? data : Number(data);
  if (!Number.isInteger(stock)) throw new Error("No se actualizó el stock.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: input.tipo === "entrada" ? "inventario.reposicion" : "inventario.ajuste",
    detalle: {
      producto_id: input.productoId,
      sucursal_id: input.sucursalId,
      cantidad: input.cantidad,
      stock,
    },
  });
  return stock;
}

async function exigirInventario(slug: string, sucursalId: string | null, roles: readonly RolTienda[]) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  if (sucursalId !== null && !esUuid(sucursalId)) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId, roles });
  return { tienda, staff };
}

async function productoDeLaTienda(tiendaId: string, productoId: string) {
  if (!esUuid(productoId)) throw new NoEncontrado();
  const service = createServiceClient();
  const { data, error } = await service
    .from("productos")
    .select("id, tienda_id")
    .eq("id", productoId)
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string; tienda_id: string } | null;
  if (!fila || fila.tienda_id !== tiendaId) throw new NoEncontrado();
}

function uuid(valor: unknown): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  return id;
}

function entero(valor: number | string): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isInteger(numero)) throw new Error("Stock inválido.");
  return numero;
}

function lanzarInventario(mensaje: string): never {
  const linea = mensaje.match(/Línea \d+: [^.]+\./);
  if (linea) throw new NegocioError(linea[0]);
  const conocidos = [
    "El tipo de movimiento no es válido.",
    "Escribe el motivo del movimiento.",
    "El motivo es demasiado largo.",
    "El producto no se ofrece en esa sucursal.",
    "El stock no puede ser negativo.",
    "El stock no cambió.",
    "La cantidad tiene que ser mayor que cero.",
    "No hay stock suficiente.",
    "Elige otra sucursal de destino.",
    "Define primero la disponibilidad del producto en la sucursal de destino.",
    "La sucursal no pertenece a la tienda.",
    "Hay más de un producto con ese nombre.",
    "No encontré el producto.",
    "No encontré la sucursal.",
    "No tienes acceso a esa sucursal.",
    "El archivo tiene demasiadas filas.",
    "El archivo no tiene filas.",
    "El stock mínimo no puede ser negativo.",
    "La licencia no está vigente. El panel está en solo lectura.",
  ];
  for (const texto of conocidos) {
    if (mensaje.includes(texto)) throw new NegocioError(texto);
  }
  throw new Error(mensaje);
}
