export class NegocioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NegocioError";
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ESTADOS_LICENCIA = ["prueba", "activa", "vencida", "suspendida"] as const;
export type EstadoLicencia = (typeof ESTADOS_LICENCIA)[number];

export const METODOS_PAGO = ["qr", "transferencia"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const DIAS_PRUEBA_DEFECTO = 14;
export const DIAS_GRACIA_DEFECTO = 3;

export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

export function esEstadoLicencia(valor: string): valor is EstadoLicencia {
  return (ESTADOS_LICENCIA as readonly string[]).includes(valor);
}

export function esMetodoPago(valor: string): valor is MetodoPago {
  return (METODOS_PAGO as readonly string[]).includes(valor);
}

export function etiquetaLicencia(estado: EstadoLicencia): string {
  if (estado === "prueba") return "Prueba";
  if (estado === "activa") return "Activa";
  if (estado === "vencida") return "Vencida";
  return "Suspendida";
}

export function etiquetaMetodo(metodo: MetodoPago): string {
  if (metodo === "qr") return "QR";
  return "Transferencia";
}

export function hoyBolivia(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function fechaValida(valor: string): boolean {
  const coincidencia = FECHA.exec(valor);
  if (!coincidencia) return false;
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export function sumarDias(fecha: string, dias: number): string {
  if (!fechaValida(fecha) || !Number.isInteger(dias)) {
    throw new NegocioError("Fecha inválida.");
  }
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

export const PLAZOS = ["mensual", "trimestral", "anual", "demo"] as const;
export type Plazo = (typeof PLAZOS)[number];

export function esPlazo(valor: string): valor is Plazo {
  return (PLAZOS as readonly string[]).includes(valor);
}

export function etiquetaPlazo(plazo: Plazo): string {
  if (plazo === "mensual") return "Mensual";
  if (plazo === "trimestral") return "Trimestral";
  if (plazo === "anual") return "Anual";
  return "Demo";
}

export function licenciaEstaVigente(input: {
  estadoTienda: string;
  estadoLicencia: string;
  vence: string | null;
  diasGracia: number;
  hoy: string;
}): boolean {
  if (input.estadoTienda !== "activa") return false;
  if (input.estadoLicencia !== "prueba" && input.estadoLicencia !== "activa") return false;
  if (!fechaValida(input.hoy)) return false;
  if (!Number.isInteger(input.diasGracia) || input.diasGracia < 0) return false;
  if (input.vence == null) return true;
  if (!fechaValida(input.vence)) return false;
  return input.hoy <= sumarDias(input.vence, input.diasGracia);
}

export function vencePronto(vence: string | null, hoy: string): boolean {
  if (!vence || !fechaValida(vence) || !fechaValida(hoy)) return false;
  const limite = sumarDias(hoy, 7);
  return vence >= hoy && vence <= limite;
}

export function parseMonto(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const monto = Number(limpio);
  if (monto > 99_999_999.99) return null;
  return monto;
}

export function parseEntero(texto: string, minimo: number, maximo: number): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const valor = Number(texto.trim());
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) return null;
  return valor;
}

export function parseCorreo(texto: string): string | null {
  const correo = texto.trim().toLowerCase();
  if (correo.length < 3 || correo.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return null;
  return correo;
}

export function formatoBs(monto: number): string {
  const numero = new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
  return `Bs ${numero}`;
}

export function formatoFecha(iso: string): string {
  if (!fechaValida(iso.slice(0, 10))) return iso;
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

export function textoTope(valor: number | null, ilimitado: string): string {
  if (valor == null) return ilimitado;
  return String(valor);
}
