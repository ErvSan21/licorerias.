import { NegocioError } from "@/lib/licencias/reglas";

export { NegocioError };

export const ESTADOS_PEDIDO = ["pendiente", "aceptado", "listo", "enviado", "cancelado"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export function etiquetaEstadoPedido(estado: EstadoPedido): string {
  if (estado === "pendiente") return "Nuevo";
  if (estado === "aceptado") return "Aceptado";
  if (estado === "listo") return "Listo";
  if (estado === "enviado") return "Enviado";
  return "Cancelado";
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
  return nombre;
}

export function parseDireccion(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length < 4 || texto.length > 200) throw new NegocioError("Escribe la dirección.");
  return texto;
}

export function parseReferencia(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length > 200) throw new NegocioError("La referencia es demasiado larga.");
  return texto;
}

export type AccionPedido = {
  estado: "aceptado" | "listo" | "enviado";
  etiqueta: string;
  cancelar: boolean;
};

export function accionPedido(estado: EstadoPedido, tipo: "delivery" | "recojo"): AccionPedido | null {
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
  if (estado === "listo") return 2;
  if (estado === "enviado" && tipo === "delivery") return 3;
  return 2;
}

export function mensajeSeguimiento(estado: EstadoPedido, tipo: "delivery" | "recojo"): string {
  if (estado === "cancelado") return "Pedido cancelado";
  const pasos = pasosSeguimiento(tipo);
  return pasos[indiceSeguimiento(estado, tipo)] ?? "Recibido";
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
