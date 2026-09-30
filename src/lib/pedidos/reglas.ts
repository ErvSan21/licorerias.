import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { capitalizar } from "@/lib/texto";

export { NegocioError };

export const ESTADOS_PEDIDO = [
  "pendiente",
  "aceptado",
  "listo",
  "enviado",
  "preparando",
  "recogido",
  "entregado",
  "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** "panel": venta cargada por el personal; "tienda": pedido de la tienda en línea. */
export type OrigenPedido = "panel" | "tienda";

export function esOrigenPedido(valor: unknown): valor is OrigenPedido {
  return valor === "panel" || valor === "tienda";
}

export const METODOS_PAGO = ["efectivo", "qr"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export function parseMetodoPago(valor: unknown): MetodoPago {
  if (valor === "efectivo" || valor === "qr") return valor;
  throw new NegocioError("Elige cómo paga: QR o efectivo.");
}

export function etiquetaMetodoPago(metodo: MetodoPago): string {
  return metodo === "qr" ? "QR" : "Efectivo";
}

export function esEstadoPedido(valor: string): valor is EstadoPedido {
  return (ESTADOS_PEDIDO as readonly string[]).includes(valor);
}

/** Código corto que ve el personal: los 6 primeros caracteres del id. */
/**
 * Estado del cobro de un pedido de la tienda en línea.
 * Efectivo: se cobra al entregar. QR: el personal tiene que verificar la transferencia.
 */
export function estadoPago(pedido: {
  origen: OrigenPedido;
  metodoPago: MetodoPago | null;
  pagoConfirmado: boolean;
  estado: EstadoPedido;
}): { etiqueta: string; tono: "ok" | "warn" } | null {
  if (pedido.origen === "panel" || pedido.estado === "cancelado") return null;
  if (pedido.pagoConfirmado) return { etiqueta: "Pagado", tono: "ok" };
  if (pedido.metodoPago === "qr") return { etiqueta: "Verificar pago", tono: "warn" };
  return { etiqueta: "Pendiente de pago", tono: "warn" };
}

export function referenciaPedido(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function tonoEstadoPedido(estado: EstadoPedido): "brand" | "warn" | "ok" | "danger" {
  if (estado === "pendiente") return "brand";
  if (estado === "aceptado" || estado === "preparando") return "warn";
  if (estado === "recogido") return "brand";
  if (estado === "cancelado") return "danger";
  return "ok";
}

/** En las ventas del panel el primer estado se llama "Registrado"; en la tienda, "Nuevo". */
export function etiquetaEstadoPedido(estado: EstadoPedido, origen: OrigenPedido = "tienda"): string {
  if (estado === "pendiente") return origen === "panel" ? "Registrado" : "Nuevo";
  if (estado === "aceptado") return "Aceptado";
  if (estado === "listo") return "Listo";
  if (estado === "enviado") return "Enviado";
  if (estado === "preparando") return "Preparando";
  if (estado === "recogido") return "Recogido";
  if (estado === "entregado") return "Entregado";
  return "Cancelado";
}

/** Pasos de una venta del panel, en orden. */
export function pasosVenta(tipo: "delivery" | "recojo"): EstadoPedido[] {
  return tipo === "delivery"
    ? ["pendiente", "aceptado", "preparando", "recogido", "entregado"]
    : ["pendiente", "aceptado", "entregado"];
}

export function etiquetaEntrega(tipo: "delivery" | "recojo"): string {
  return tipo === "delivery" ? "Delivery" : "Recojo";
}

export function normalizarTelefono(valor: unknown): string {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  const local = digitos.startsWith("591") && digitos.length === 11 ? digitos.slice(3) : digitos;
  if (!/^[67]\d{7}$/.test(local)) throw new NegocioError("Escribe un celular de Bolivia.");
  return `591${local}`;
}

export function parseNombreCliente(valor: unknown): string {
  const nombre = String(valor ?? "").trim();
  if (nombre.length < 2 || nombre.length > 80) throw new NegocioError("Escribe el nombre.");
  return capitalizar(nombre);
}

export function parseDireccion(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length < 4 || texto.length > 200) throw new NegocioError("Escribe la dirección.");
  return capitalizar(texto);
}

export function parseReferencia(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length > 200) throw new NegocioError("La referencia es demasiado larga.");
  return capitalizar(texto);
}

export type AccionPedido = {
  estado: Exclude<EstadoPedido, "pendiente" | "cancelado">;
  etiqueta: string;
  cancelar: boolean;
};

/** Siguiente paso y si todavía se puede cancelar. Misma regla que cambiar_estado en la base. */
export function accionPedido(
  estado: EstadoPedido,
  tipo: "delivery" | "recojo",
  origen: OrigenPedido = "tienda",
): AccionPedido | null {
  if (origen === "panel") {
    if (estado === "pendiente") return { estado: "aceptado", etiqueta: "Aceptar pedido", cancelar: true };
    if (estado === "aceptado" && tipo === "recojo") {
      return { estado: "entregado", etiqueta: "Marcar como entregado", cancelar: true };
    }
    if (estado === "aceptado") return { estado: "preparando", etiqueta: "Marcar como preparando", cancelar: true };
    if (estado === "preparando") return { estado: "recogido", etiqueta: "Marcar como recogido", cancelar: true };
    if (estado === "recogido") return { estado: "entregado", etiqueta: "Marcar como entregado", cancelar: false };
    return null;
  }
  if (estado === "pendiente") return { estado: "aceptado", etiqueta: "Aceptar pedido", cancelar: true };
  if (estado === "aceptado") return { estado: "listo", etiqueta: "Marcar como listo", cancelar: true };
  if (estado === "listo" && tipo === "delivery") {
    return { estado: "enviado", etiqueta: "Marcar como enviado", cancelar: false };
  }
  return null;
}

export const PASOS_DELIVERY = ["Recibido", "Aceptado", "Listo", "En camino"] as const;
export const PASOS_RECOJO = ["Recibido", "Aceptado", "Listo"] as const;

/** El cliente consulta el seguimiento cada 15 segundos. */
export const intervaloSeguimientoMs = 15_000;

export type ItemSeguimiento = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type SeguimientoPublico = {
  id: string;
  estado: EstadoPedido;
  tipoEntrega: "delivery" | "recojo";
  sucursal: string;
  total: number;
  subtotal: number;
  costoEnvio: number;
  descuento: number;
  horaRecojo: string | null;
  direccion: string;
  referencia: string;
  items: ItemSeguimiento[];
  creadoEn: string;
};

export function pasosSeguimiento(tipo: "delivery" | "recojo"): readonly string[] {
  return tipo === "delivery" ? PASOS_DELIVERY : PASOS_RECOJO;
}

/** -1 si el pedido está cancelado. Si no, el índice del paso visible. */
export function indiceSeguimiento(estado: EstadoPedido, tipo: "delivery" | "recojo"): number {
  if (estado === "cancelado") return -1;
  if (estado === "pendiente") return 0;
  if (estado === "aceptado") return 1;
  if (estado === "listo" || estado === "preparando") return 2;
  if ((estado === "enviado" || estado === "recogido" || estado === "entregado") && tipo === "delivery") return 3;
  return 2;
}

export function mensajeSeguimiento(estado: EstadoPedido, tipo: "delivery" | "recojo"): string {
  if (estado === "cancelado") return "Pedido cancelado";
  const pasos = pasosSeguimiento(tipo);
  return pasos[indiceSeguimiento(estado, tipo)] ?? "Recibido";
}

/** Nombre que se guarda cuando una venta de mostrador no lo tiene. */
export const CLIENTE_SIN_NOMBRE = "Cliente";

/**
 * `mostrador`: venta del personal. En recojo, nombre y celular son opcionales.
 * El pedido público siempre exige los dos.
 */
export function pedidoDesdeJson(
  cuerpo: Record<string, unknown>,
  { mostrador = false }: { mostrador?: boolean } = {},
): {
  sucursalId: string;
  nombre: string;
  telefono: string | null;
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
  const opcional = mostrador && tipo === "recojo";
  const vacio = (valor: unknown) => String(valor ?? "").trim() === "";
  return {
    sucursalId: String(cuerpo.sucursalId ?? ""),
    nombre: opcional && vacio(cuerpo.nombre) ? CLIENTE_SIN_NOMBRE : parseNombreCliente(cuerpo.nombre),
    telefono: opcional && vacio(cuerpo.telefono) ? null : normalizarTelefono(cuerpo.telefono),
    tipo,
    lat: cuerpo.lat == null || cuerpo.lat === "" ? null : Number(cuerpo.lat),
    lng: cuerpo.lng == null || cuerpo.lng === "" ? null : Number(cuerpo.lng),
    direccion: tipo === "delivery" ? parseDireccion(cuerpo.direccion) : "",
    referencia: parseReferencia(cuerpo.referencia),
    horaRecojo: hora,
    items,
  };
}

export function seguimientoDesdeJson(data: unknown): SeguimientoPublico | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const fila = data as Record<string, unknown>;
  const estado = fila.estado;
  const tipo = fila.tipoEntrega;
  if (typeof fila.id !== "string" || !esEstado(estado)) return null;
  if (tipo !== "delivery" && tipo !== "recojo") return null;
  if (typeof fila.sucursal !== "string" || typeof fila.creadoEn !== "string") return null;
  const total = numero(fila.total);
  const subtotal = numero(fila.subtotal);
  const costoEnvio = numero(fila.costoEnvio);
  const descuento = numero(fila.descuento);
  if (total == null || subtotal == null || costoEnvio == null || descuento == null) return null;
  if (!Array.isArray(fila.items)) return null;
  const items: ItemSeguimiento[] = [];
  for (const item of fila.items) {
    if (!item || typeof item !== "object") return null;
    const linea = item as Record<string, unknown>;
    const precioUnitario = numero(linea.precioUnitario);
    const cantidad = numero(linea.cantidad);
    if (typeof linea.nombre !== "string" || precioUnitario == null || cantidad == null || !Number.isInteger(cantidad)) {
      return null;
    }
    items.push({ nombre: linea.nombre, cantidad, precioUnitario });
  }
  const hora = fila.horaRecojo;
  return {
    id: fila.id,
    estado,
    tipoEntrega: tipo,
    sucursal: fila.sucursal,
    total,
    subtotal,
    costoEnvio,
    descuento,
    horaRecojo: typeof hora === "string" ? hora : null,
    direccion: typeof fila.direccion === "string" ? fila.direccion : "",
    referencia: typeof fila.referencia === "string" ? fila.referencia : "",
    items,
    creadoEn: fila.creadoEn,
  };
}

function esEstado(valor: unknown): valor is EstadoPedido {
  return typeof valor === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(valor);
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "" && Number.isFinite(Number(valor))) return Number(valor);
  return null;
}

export function rangoDiaBolivia(fecha: string): { desde: string; hasta: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return {
    desde: `${fecha}T00:00:00-04:00`,
    hasta: `${fecha}T23:59:59-04:00`,
  };
}
