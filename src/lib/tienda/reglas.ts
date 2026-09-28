import { haversineKm, type Punto } from "@/lib/envio/reglas";
import { normalizarTelefono } from "@/lib/pedidos/reglas";
import { DIAS, type Dia, type Horario } from "@/lib/sucursales/reglas";

export type SucursalCercana = { slug: string; lat: number | null; lng: number | null };

export type ProductoVitrina = {
  id: string;
  precioFinal: number;
  agotado: boolean;
};

export type LineaGuardada = { productoId: string; cantidad: number; precioFinal: number };

export type AvisoCarrito = {
  productoId: string;
  nombre: string;
  tipo: "precio" | "agotado" | "fuera";
};

const DIA_CORTO: Record<string, Dia> = {
  Mon: "lun",
  Tue: "mar",
  Wed: "mie",
  Thu: "jue",
  Fri: "vie",
  Sat: "sab",
  Sun: "dom",
};

export function abiertaEn(abierta: boolean, horario: Horario, ahora: Date): boolean {
  if (!abierta) return false;
  const partes = partesBolivia(ahora);
  const franja = horario[partes.dia];
  if (!franja?.abierto || !franja.desde || !franja.hasta) return false;
  return partes.hora >= franja.desde && partes.hora < franja.hasta;
}

export function sucursalMasCercana(punto: Punto, sucursales: readonly SucursalCercana[]): string | null {
  let mejor: { slug: string; km: number } | null = null;
  for (const sucursal of sucursales) {
    if (sucursal.lat == null || sucursal.lng == null) continue;
    const km = haversineKm(punto, { lat: sucursal.lat, lng: sucursal.lng });
    if (!mejor || km < mejor.km) mejor = { slug: sucursal.slug, km };
  }
  return mejor?.slug ?? null;
}

export function telefonoDesdeConsulta(valor: string | null | undefined): string {
  if (!valor) return "";
  try {
    return normalizarTelefono(valor).slice(3);
  } catch {
    return "";
  }
}

export function reconciliarCarrito(
  guardadas: readonly LineaGuardada[],
  productos: readonly (ProductoVitrina & { nombre: string })[],
): { lineas: { productoId: string; cantidad: number }[]; avisos: AvisoCarrito[] } {
  const porId = new Map(productos.map((producto) => [producto.id, producto]));
  const lineas: { productoId: string; cantidad: number }[] = [];
  const avisos: AvisoCarrito[] = [];
  for (const linea of guardadas) {
    const producto = porId.get(linea.productoId);
    if (!producto) {
      avisos.push({ productoId: linea.productoId, nombre: "Producto", tipo: "fuera" });
      continue;
    }
    if (producto.agotado) {
      avisos.push({ productoId: producto.id, nombre: producto.nombre, tipo: "agotado" });
      continue;
    }
    if (producto.precioFinal !== linea.precioFinal) {
      avisos.push({ productoId: producto.id, nombre: producto.nombre, tipo: "precio" });
    }
    const cantidad = Math.min(99, Math.max(1, Math.trunc(linea.cantidad)));
    lineas.push({ productoId: producto.id, cantidad });
  }
  return { lineas, avisos };
}

export function opcionesRecojo(horario: Horario, minutos: number, ahora: Date): string[] {
  const inicio = ahora.getTime() + Math.max(0, minutos) * 60_000;
  const limite = ahora.getTime() + 48 * 60 * 60_000;
  const primero = Math.ceil(inicio / (30 * 60_000)) * 30 * 60_000;
  const horas: string[] = [];
  for (let marca = primero; marca <= limite && horas.length < 12; marca += 30 * 60_000) {
    if (abiertaEn(true, horario, new Date(marca))) horas.push(new Date(marca).toISOString());
  }
  return horas;
}

export function horarioDesdeJson(valor: unknown): Horario {
  const vacio = Object.fromEntries(DIAS.map((dia) => [dia, { abierto: false, desde: "00:00", hasta: "00:01" }])) as Horario;
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return vacio;
  const origen = valor as Record<string, unknown>;
  for (const dia of DIAS) {
    const franja = origen[dia];
    if (!franja || typeof franja !== "object" || Array.isArray(franja)) continue;
    const fila = franja as { abierto?: unknown; desde?: unknown; hasta?: unknown };
    const desde = String(fila.desde ?? "");
    const hasta = String(fila.hasta ?? "");
    if (!/^\d{2}:\d{2}$/.test(desde) || !/^\d{2}:\d{2}$/.test(hasta)) continue;
    vacio[dia] = { abierto: fila.abierto === true, desde, hasta };
  }
  return vacio;
}

function partesBolivia(ahora: Date): { dia: Dia; hora: string } {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const partes = formato.formatToParts(ahora);
  const semana = partes.find((parte) => parte.type === "weekday")?.value ?? "Mon";
  const hora = (partes.find((parte) => parte.type === "hour")?.value ?? "00").padStart(2, "0");
  const minuto = (partes.find((parte) => parte.type === "minute")?.value ?? "00").padStart(2, "0");
  return { dia: DIA_CORTO[semana] ?? "lun", hora: `${hora}:${minuto}` };
}
