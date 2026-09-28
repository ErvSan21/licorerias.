import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { calcularEnvio } from "@/lib/envio/servicio";
import { esUuid } from "@/lib/licencias/reglas";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { createServiceClient } from "@/lib/supabase/service";
import { ROLES_TIENDA, type RolTienda } from "@/lib/tenant";

import { notificarEstado } from "./avisos";
import {
  NegocioError,
  normalizarTelefono,
  parseDireccion,
  parseNombreCliente,
  parseReferencia,
  rangoDiaBolivia,
  type EstadoPedido,
} from "./reglas";

const OPERACION = ["dueno", "gerente", "vendedor"] as const;

export type ItemPedido = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioOriginal: number;
  precioUnitario: number;
  origen: string;
};

export type PedidoLista = {
  id: string;
  sucursalId: string;
  sucursal: string;
  cliente: string;
  telefono: string;
  tipo: "delivery" | "recojo";
  lat: number | null;
  lng: number | null;
  direccion: string;
  referencia: string;
  distanciaKm: number;
  subtotal: number;
  costoEnvio: number;
  descuento: number;
  total: number;
  horaRecojo: string | null;
  estado: EstadoPedido;
  creadoEn: string;
  items: ItemPedido[];
};

export async function listarPedidos(
  slug: string,
  filtro: { estado: string | null; tipo: string | null; sucursalId: string | null; fecha: string | null },
): Promise<{ pedidos: PedidoLista[]; sucursales: { id: string; nombre: string }[] }> {
  const { tienda, staff } = await exigir(slug, null, ROLES_TIENDA);
  const permitidas = await sucursalesPermitidas(staff.miembroId, staff.rol, tienda.id);
  const service = createServiceClient();
  let consulta = service
    .from("pedidos")
    .select(
      "id, tienda_id, sucursal_id, cliente_nombre, telefono, tipo_entrega, lat, lng, direccion, direccion_referencia, distancia_km, subtotal, costo_envio, descuento, total, hora_recojo, estado, creado_en",
    )
    .eq("tienda_id", tienda.id)
    .order("creado_en", { ascending: false })
    .limit(100);
  if (filtro.estado) consulta = consulta.eq("estado", filtro.estado);
  if (filtro.tipo) consulta = consulta.eq("tipo_entrega", filtro.tipo);
  if (filtro.sucursalId) consulta = consulta.eq("sucursal_id", filtro.sucursalId);
  const dia = filtro.fecha ? rangoDiaBolivia(filtro.fecha) : null;
  if (dia) consulta = consulta.gte("creado_en", dia.desde).lte("creado_en", dia.hasta);

  const [pedidosRes, sucursalesRes] = await Promise.all([
    consulta,
    service.from("sucursales").select("id, nombre").eq("tienda_id", tienda.id).order("nombre"),
  ]);
  if (pedidosRes.error) throw new Error(pedidosRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);

  const sucursales = ((sucursalesRes.data ?? []) as { id: string; nombre: string }[]).filter((fila) =>
    permitidas.has(fila.id),
  );
  const nombres = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));
  const filas = ((pedidosRes.data ?? []) as FilaPedido[]).filter(
    (fila) => fila.tienda_id === tienda.id && permitidas.has(fila.sucursal_id),
  );
  const ids = filas.map((fila) => fila.id);
  const items = ids.length === 0 ? [] : await leerItems(ids, tienda.id);
  const porPedido = new Map<string, ItemPedido[]>();
  for (const item of items) {
    const lista = porPedido.get(item.pedidoId) ?? [];
    lista.push(item.item);
    porPedido.set(item.pedidoId, lista);
  }

  let pedidos = filas.map((fila) => aLista(fila, nombres.get(fila.sucursal_id) ?? "Sucursal", porPedido.get(fila.id) ?? []));
  if (filtro.tipo === "recojo") {
    pedidos = pedidos.toSorted((a, b) => {
      if (a.horaRecojo && b.horaRecojo) return a.horaRecojo.localeCompare(b.horaRecojo);
      if (a.horaRecojo) return -1;
      if (b.horaRecojo) return 1;
      return b.creadoEn.localeCompare(a.creadoEn);
    });
  }
  return { pedidos, sucursales };
}

export async function leerPedido(slug: string, pedidoId: string): Promise<{
  pedido: PedidoLista;
  historial: { estado: EstadoPedido; creadoEn: string }[];
}> {
  if (!esUuid(pedidoId)) throw new NoEncontrado();
  const { tienda, staff } = await exigir(slug, null, ROLES_TIENDA);
  const permitidas = await sucursalesPermitidas(staff.miembroId, staff.rol, tienda.id);
  const service = createServiceClient();
  const { data: fila, error: errorPedido } = await service
    .from("pedidos")
    .select(
      "id, tienda_id, sucursal_id, cliente_nombre, telefono, tipo_entrega, lat, lng, direccion, direccion_referencia, distancia_km, subtotal, costo_envio, descuento, total, hora_recojo, estado, creado_en",
    )
    .eq("id", pedidoId)
    .eq("tienda_id", tienda.id)
    .maybeSingle();
  if (errorPedido) throw new Error(errorPedido.message);
  const cruda = fila as FilaPedido | null;
  if (!cruda || !permitidas.has(cruda.sucursal_id)) throw new NoEncontrado();
  const { data: sucursal, error: errorSucursal } = await service
    .from("sucursales")
    .select("nombre")
    .eq("id", cruda.sucursal_id)
    .maybeSingle();
  if (errorSucursal) throw new Error(errorSucursal.message);
  const items = await leerItems([cruda.id], tienda.id);
  const pedido = aLista(
    cruda,
    (sucursal as { nombre: string } | null)?.nombre ?? "Sucursal",
    items.map((item) => item.item),
  );
  const { data, error } = await service
    .from("pedido_historial")
    .select("estado, creado_en")
    .eq("pedido_id", pedidoId)
    .order("creado_en");
  if (error) throw new Error(error.message);
  return {
    pedido,
    historial: ((data ?? []) as { estado: string; creado_en: string }[]).flatMap((fila) => {
      if (!esEstado(fila.estado)) return [];
      return [{ estado: fila.estado, creadoEn: fila.creado_en }];
    }),
  };
}

export async function crearPedidoPublico(input: {
  sucursalId: string;
  nombre: string;
  telefono: string;
  tipo: "delivery" | "recojo";
  lat: number | null;
  lng: number | null;
  direccion: string;
  referencia: string;
  horaRecojo: string | null;
  items: { productoId: string; cantidad: number }[];
}): Promise<string> {
  if (!esUuid(input.sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  let distancia = 0;
  let envio = 0;
  let lat: number | null = null;
  let lng: number | null = null;
  let direccion = "";
  if (input.tipo === "delivery") {
    if (input.lat == null || input.lng == null) throw new NegocioError("La latitud tiene que estar entre -90 y 90.");
    const calculo = await calcularEnvio(input.sucursalId, { lat: input.lat, lng: input.lng });
    if (!calculo.disponible) {
      throw new NegocioError(
        calculo.motivo === "sin_ubicacion" ? "La sucursal no tiene ubicación." : "Fuera de zona de entrega.",
      );
    }
    distancia = calculo.distanciaKm;
    envio = calculo.costo;
    lat = input.lat;
    lng = input.lng;
    direccion = input.direccion;
  }
  const service = createServiceClient();
  const { data, error } = await service.rpc("crear_pedido", {
    p_sucursal: input.sucursalId,
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_tipo: input.tipo,
    p_lat: lat,
    p_lng: lng,
    p_direccion: direccion,
    p_referencia: input.referencia,
    p_distancia: distancia,
    p_envio: envio,
    p_hora_recojo: input.tipo === "recojo" ? input.horaRecojo : null,
    p_items: input.items.map((item) => ({ producto_id: item.productoId, cantidad: item.cantidad })),
  });
  if (error) lanzar(error.message);
  if (typeof data !== "string") throw new Error("No se creó el pedido.");
  await notificarEstado(data, "pendiente");
  return data;
}

export async function cambiarEstadoPedido(slug: string, pedidoId: string, estado: string): Promise<void> {
  if (!esUuid(pedidoId) || !esEstado(estado) || estado === "pendiente") {
    throw new NegocioError("Ese cambio de estado no está permitido.");
  }
  const service = createServiceClient();
  const { data: fila, error } = await service
    .from("pedidos")
    .select("id, tienda_id, sucursal_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const pedido = fila as { id: string; tienda_id: string; sucursal_id: string } | null;
  if (!pedido) throw new NoEncontrado();
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda || tienda.id !== pedido.tienda_id) throw new NoEncontrado();
  const staff = await requireStaff({
    tiendaId: tienda.id,
    sucursalId: pedido.sucursal_id,
    roles: OPERACION,
  });
  await exigirLicenciaParaEscribir(tienda.id);
  const { error: cambio } = await service.rpc("cambiar_estado", {
    p_pedido: pedido.id,
    p_nuevo: estado,
    p_user: staff.userId,
  });
  if (cambio) lanzar(cambio.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "pedido.estado",
    detalle: { pedido_id: pedido.id, estado },
  });
  await notificarEstado(pedido.id, estado);
}

export function pedidoDesdeJson(cuerpo: Record<string, unknown>): {
  sucursalId: string;
  nombre: string;
  telefono: string;
  tipo: "delivery" | "recojo";
  lat: number | null;
  lng: number | null;
  direccion: string;
  referencia: string;
  horaRecojo: string | null;
  items: { productoId: string; cantidad: number }[];
} {
  const tipo = cuerpo.tipo === "delivery" ? "delivery" : cuerpo.tipo === "recojo" ? "recojo" : null;
  if (!tipo) throw new NegocioError("El tipo de entrega no es válido.");
  const crudos = Array.isArray(cuerpo.items) ? cuerpo.items : [];
  const items = crudos.map((item) => {
    if (!item || typeof item !== "object") throw new NegocioError("Agrega un producto.");
    const fila = item as { productoId?: unknown; cantidad?: unknown };
    const productoId = String(fila.productoId ?? "");
    const cantidad = Number(fila.cantidad);
    if (!esUuid(productoId) || !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 99) {
      throw new NegocioError("La cantidad tiene que ser mayor que cero.");
    }
    return { productoId, cantidad };
  });
  if (items.length === 0) throw new NegocioError("Agrega un producto.");
  const hora = cuerpo.horaRecojo == null || cuerpo.horaRecojo === "" ? null : String(cuerpo.horaRecojo);
  if (hora && Number.isNaN(new Date(hora).getTime())) throw new NegocioError("Elige una hora con más anticipación.");
  return {
    sucursalId: String(cuerpo.sucursalId ?? ""),
    nombre: parseNombreCliente(cuerpo.nombre),
    telefono: normalizarTelefono(cuerpo.telefono),
    tipo,
    lat: cuerpo.lat == null || cuerpo.lat === "" ? null : Number(cuerpo.lat),
    lng: cuerpo.lng == null || cuerpo.lng === "" ? null : Number(cuerpo.lng),
    direccion: tipo === "delivery" ? parseDireccion(cuerpo.direccion) : "",
    referencia: parseReferencia(cuerpo.referencia),
    horaRecojo: hora,
    items,
  };
}

async function leerItems(ids: string[], tiendaId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("pedido_items")
    .select("pedido_id, producto_id, nombre_producto, cantidad, precio_original, precio_unitario, origen_precio, tienda_id")
    .in("pedido_id", ids)
    .eq("tienda_id", tiendaId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    pedido_id: string;
    producto_id: string;
    nombre_producto: string;
    cantidad: number;
    precio_original: number | string;
    precio_unitario: number | string;
    origen_precio: string;
    tienda_id: string;
  }[])
    .filter((fila) => fila.tienda_id === tiendaId)
    .map((fila) => ({
      pedidoId: fila.pedido_id,
      item: {
        productoId: fila.producto_id,
        nombre: fila.nombre_producto,
        cantidad: fila.cantidad,
        precioOriginal: Number(fila.precio_original),
        precioUnitario: Number(fila.precio_unitario),
        origen: fila.origen_precio,
      } satisfies ItemPedido,
    }));
}

function aLista(fila: FilaPedido, sucursal: string, items: ItemPedido[]): PedidoLista {
  const tipo = fila.tipo_entrega === "delivery" ? "delivery" : "recojo";
  return {
    id: fila.id,
    sucursalId: fila.sucursal_id,
    sucursal,
    cliente: fila.cliente_nombre,
    telefono: fila.telefono,
    tipo,
    lat: fila.lat,
    lng: fila.lng,
    direccion: fila.direccion,
    referencia: fila.direccion_referencia ?? "",
    distanciaKm: Number(fila.distancia_km),
    subtotal: Number(fila.subtotal),
    costoEnvio: Number(fila.costo_envio),
    descuento: Number(fila.descuento),
    total: Number(fila.total),
    horaRecojo: fila.hora_recojo,
    estado: esEstado(fila.estado) ? fila.estado : "pendiente",
    creadoEn: fila.creado_en,
    items,
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
  const { data, error } = await service.from("miembro_sucursales").select("sucursal_id").eq("miembro_id", miembroId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { sucursal_id: string }[]).map((fila) => fila.sucursal_id));
}

function esEstado(valor: string): valor is EstadoPedido {
  return valor === "pendiente" || valor === "aceptado" || valor === "listo" || valor === "enviado" || valor === "cancelado";
}

function lanzar(mensaje: string): never {
  const conocidos = [
    "El tipo de entrega no es válido.",
    "Escribe el nombre.",
    "Escribe un celular de Bolivia.",
    "Agrega un producto.",
    "La sucursal no pertenece a la tienda.",
    "Tienda no disponible.",
    "La sucursal está cerrada.",
    "La sucursal está cerrada a esa hora.",
    "Esta sucursal no acepta delivery.",
    "Esta sucursal no acepta recojo.",
    "La hora programada es solo para recojo.",
    "Elige una hora con más anticipación.",
    "La latitud tiene que estar entre -90 y 90.",
    "Escribe la dirección.",
    "Fuera de zona de entrega.",
    "La cantidad tiene que ser mayor que cero.",
    "El producto no se ofrece en esa sucursal.",
    "El producto no pertenece a la tienda.",
    "No hay stock suficiente.",
    "Ese cambio de estado no está permitido.",
    "Pedido no encontrado.",
    "No puedes cambiar este pedido.",
    "La sucursal no tiene ubicación.",
  ];
  for (const texto of conocidos) {
    if (mensaje.includes(texto)) {
      if (texto === "Pedido no encontrado.") throw new NoEncontrado();
      throw new NegocioError(texto);
    }
  }
  throw new Error(mensaje);
}

type FilaPedido = {
  id: string;
  tienda_id: string;
  sucursal_id: string;
  cliente_nombre: string;
  telefono: string;
  tipo_entrega: string;
  lat: number | null;
  lng: number | null;
  direccion: string;
  direccion_referencia: string | null;
  distancia_km: number | string;
  subtotal: number | string;
  costo_envio: number | string;
  descuento: number | string;
  total: number | string;
  hora_recojo: string | null;
  estado: string;
  creado_en: string;
};
