import { NegocioError } from "@/lib/licencias/reglas";

const fechaBolivia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

export type FilaNumero = { nombre: string; ventas: number; pedidos?: number; unidades?: number };

export type Reporte = {
  ventas: number;
  pedidos: number;
  ticket: number;
  cancelados: number;
  montoCancelado: number;
  sucursales: { id: string; nombre: string; ventas: number; pedidos: number }[];
  categorias: { nombre: string; ventas: number; unidades: number }[];
  productos: { nombre: string; unidades: number; ventas: number }[];
  masVendido: { nombre: string; unidades: number } | null;
  menosVendido: { nombre: string; unidades: number } | null;
  entregas: { tipo: "delivery" | "recojo"; pedidos: number; ventas: number }[];
  dias: { dia: number; pedidos: number; ventas: number }[];
  horas: { hora: number; pedidos: number }[];
  origenes: { origen: "central" | "propio" | "oferta"; ventas: number }[];
  personal: { usuario: string; cambios: number }[];
  inventario: { id: string; nombre: string; valor: number }[];
};

export function reporteVacio(): Reporte {
  return {
    ventas: 0,
    pedidos: 0,
    ticket: 0,
    cancelados: 0,
    montoCancelado: 0,
    sucursales: [],
    categorias: [],
    productos: [],
    masVendido: null,
    menosVendido: null,
    entregas: [
      { tipo: "delivery", pedidos: 0, ventas: 0 },
      { tipo: "recojo", pedidos: 0, ventas: 0 },
    ],
    dias: diasSemana.map((_, dia) => ({ dia, pedidos: 0, ventas: 0 })),
    horas: [],
    origenes: [
      { origen: "central", ventas: 0 },
      { origen: "propio", ventas: 0 },
      { origen: "oferta", ventas: 0 },
    ],
    personal: [],
    inventario: [],
  };
}

export function rangoPorDefecto(ahora = new Date()): { desde: string; hasta: string } {
  const hasta = fechaBolivia.format(ahora);
  const ancla = new Date(`${hasta}T12:00:00.000Z`);
  ancla.setUTCDate(ancla.getUTCDate() - 6);
  return { desde: ancla.toISOString().slice(0, 10), hasta };
}

export function parseRango(desde: unknown, hasta: unknown, ahora = new Date()): { desde: string; hasta: string } {
  const defecto = rangoPorDefecto(ahora);
  const inicio = textoFecha(desde) ?? defecto.desde;
  const fin = textoFecha(hasta) ?? defecto.hasta;
  if (fin < inicio) throw new NegocioError("El rango de fechas no es válido.");
  const dias = (Date.parse(`${fin}T12:00:00.000Z`) - Date.parse(`${inicio}T12:00:00.000Z`)) / 86_400_000;
  if (dias > 366) throw new NegocioError("El rango no puede pasar de un año.");
  return { desde: inicio, hasta: fin };
}

export function sucursalesDelReporte(visibles: readonly string[], pedida: unknown): string[] {
  if (typeof pedida === "string" && pedida) {
    if (!visibles.includes(pedida)) throw new NegocioError("No tienes acceso a esa sucursal.");
    return [pedida];
  }
  return [...visibles];
}

export function reporteDesdeJson(valor: unknown): Reporte {
  const fila = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  const base = reporteVacio();
  return {
    ventas: numero(fila.ventas),
    pedidos: numero(fila.pedidos),
    ticket: numero(fila.ticket),
    cancelados: numero(fila.cancelados),
    montoCancelado: numero(fila.montoCancelado),
    sucursales: lista(fila.sucursales).flatMap((item) => {
      if (typeof item.id !== "string" || typeof item.nombre !== "string") return [];
      return [{ id: item.id, nombre: item.nombre, ventas: numero(item.ventas), pedidos: numero(item.pedidos) }];
    }),
    categorias: lista(fila.categorias).flatMap((item) => {
      if (typeof item.nombre !== "string") return [];
      return [{ nombre: item.nombre, ventas: numero(item.ventas), unidades: numero(item.unidades) }];
    }),
    productos: lista(fila.productos).flatMap((item) => {
      if (typeof item.nombre !== "string") return [];
      return [{ nombre: item.nombre, unidades: numero(item.unidades), ventas: numero(item.ventas) }];
    }),
    masVendido: extremo(fila.masVendido),
    menosVendido: extremo(fila.menosVendido),
    entregas: base.entregas.map((entrega) => {
      const hallada = lista(fila.entregas).find((item) => item.tipo === entrega.tipo);
      return hallada
        ? { tipo: entrega.tipo, pedidos: numero(hallada.pedidos), ventas: numero(hallada.ventas) }
        : entrega;
    }),
    dias: base.dias.map((dia) => {
      const hallado = lista(fila.dias).find((item) => numero(item.dia) === dia.dia);
      return hallado ? { dia: dia.dia, pedidos: numero(hallado.pedidos), ventas: numero(hallado.ventas) } : dia;
    }),
    horas: lista(fila.horas).flatMap((item) => {
      const hora = numero(item.hora);
      if (hora < 0 || hora > 23) return [];
      return [{ hora, pedidos: numero(item.pedidos) }];
    }),
    origenes: base.origenes.map((origen) => {
      const hallado = lista(fila.origenes).find((item) => item.origen === origen.origen);
      return hallado ? { origen: origen.origen, ventas: numero(hallado.ventas) } : origen;
    }),
    personal: lista(fila.personal).flatMap((item) => {
      if (typeof item.usuario !== "string") return [];
      return [{ usuario: item.usuario, cambios: numero(item.cambios) }];
    }),
    inventario: lista(fila.inventario).flatMap((item) => {
      if (typeof item.id !== "string" || typeof item.nombre !== "string") return [];
      return [{ id: item.id, nombre: item.nombre, valor: numero(item.valor) }];
    }),
  };
}

export function csvReporte(reporte: Reporte): string {
  const lineas = [
    ["sección", "nombre", "pedidos", "unidades", "monto"],
    ["ventas", "Total", String(reporte.pedidos), "", decimal(reporte.ventas)],
    ["ticket", "Promedio", "", "", decimal(reporte.ticket)],
    ["cancelaciones", "Cancelados", String(reporte.cancelados), "", decimal(reporte.montoCancelado)],
  ];
  for (const sucursal of reporte.sucursales) {
    lineas.push(["sucursal", sucursal.nombre, String(sucursal.pedidos), "", decimal(sucursal.ventas)]);
  }
  for (const categoria of reporte.categorias) {
    lineas.push(["categoría", categoria.nombre, "", String(categoria.unidades), decimal(categoria.ventas)]);
  }
  for (const producto of reporte.productos) {
    lineas.push(["producto", producto.nombre, "", String(producto.unidades), decimal(producto.ventas)]);
  }
  if (reporte.masVendido) lineas.push(["más vendido", reporte.masVendido.nombre, "", String(reporte.masVendido.unidades), ""]);
  if (reporte.menosVendido) lineas.push(["menos vendido", reporte.menosVendido.nombre, "", String(reporte.menosVendido.unidades), ""]);
  for (const entrega of reporte.entregas) {
    lineas.push(["entrega", entrega.tipo === "delivery" ? "Delivery" : "Recojo", String(entrega.pedidos), "", decimal(entrega.ventas)]);
  }
  for (const dia of reporte.dias) {
    lineas.push(["día", diasSemana[dia.dia] ?? String(dia.dia), String(dia.pedidos), "", decimal(dia.ventas)]);
  }
  for (const hora of reporte.horas) {
    lineas.push(["hora", String(hora.hora).padStart(2, "0"), String(hora.pedidos), "", ""]);
  }
  for (const origen of reporte.origenes) {
    lineas.push(["origen", origen.origen, "", "", decimal(origen.ventas)]);
  }
  for (const persona of reporte.personal) {
    lineas.push(["personal", persona.usuario, String(persona.cambios), "", ""]);
  }
  for (const sucursal of reporte.inventario) {
    lineas.push(["inventario", sucursal.nombre, "", "", decimal(sucursal.valor)]);
  }
  return lineas.map((linea) => linea.map(celda).join(",")).join("\n");
}

export function sinMovimiento(reporte: Reporte): boolean {
  return reporte.pedidos === 0 && reporte.cancelados === 0;
}

function textoFecha(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto;
}

function numero(valor: unknown): number {
  const convertido = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function lista(valor: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function extremo(valor: unknown): { nombre: string; unidades: number } | null {
  if (!valor || typeof valor !== "object") return null;
  const fila = valor as { nombre?: unknown; unidades?: unknown };
  if (typeof fila.nombre !== "string") return null;
  return { nombre: fila.nombre, unidades: numero(fila.unidades) };
}

function decimal(valor: number): string {
  return valor.toFixed(2);
}

function celda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replaceAll('"', '""')}"`;
  return valor;
}
