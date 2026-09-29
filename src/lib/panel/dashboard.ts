import type { EstadoPedido } from "@/lib/pedidos/reglas";

/** Ventas del día y de la semana. Null para el rol vendedor, que no ve reportes. */
export type VentasDashboard = {
  ventasHoy: number;
  variacion: number | null;
  pedidosHoy: number;
  ticket: number;
  semana: { dia: string; ventas: number }[];
  masVendidos: { nombre: string; unidades: number }[];
  porSucursal: { nombre: string; ventas: number }[];
};

export type DatosDashboard = {
  ventas: VentasDashboard | null;
  nuevos: number;
  stockBajo: number;
  licencia: { plan: string; dias: number | null } | null;
  ultimos: { id: string; cliente: string; tipo: "delivery" | "recojo"; total: number; estado: EstadoPedido }[];
};

const INICIAL_DIA = ["D", "L", "M", "X", "J", "V", "S"] as const;

/** Letra del día de la semana de una fecha AAAA-MM-DD. */
export function inicialDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return INICIAL_DIA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
}

/** Variación porcentual redondeada. Null si no hay base para comparar. */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
