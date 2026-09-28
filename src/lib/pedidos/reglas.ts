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

export function rangoDiaBolivia(fecha: string): { desde: string; hasta: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return {
    desde: `${fecha}T00:00:00-04:00`,
    hasta: `${fecha}T23:59:59-04:00`,
  };
}
