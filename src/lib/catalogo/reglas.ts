import { esUuid, NegocioError } from "@/lib/licencias/reglas";

export { NegocioError };

const PRECIO = /^\d+(\.\d{1,2})?$/;
const PORCENTAJE = /^-?\d+(\.\d{1,2})?$/;

const formatoBsIntl = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoFechaIntl = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/La_Paz",
});

export function formatoBs(valor: number): string {
  return `Bs ${formatoBsIntl.format(valor)}`;
}

export function formatoFechaPrecio(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return formatoFechaIntl.format(fecha);
}

export function parsePrecio(valor: unknown): number {
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  if (!PRECIO.test(texto)) {
    throw new NegocioError("Escribe un precio en Bs, con hasta 2 decimales.");
  }
  const numero = Number(texto);
  if (numero > 99_999_999.99) throw new NegocioError("El precio es demasiado alto.");
  return numero;
}

export function parsePorcentaje(valor: unknown): number {
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  if (!PORCENTAJE.test(texto)) {
    throw new NegocioError("Escribe un porcentaje con hasta 2 decimales.");
  }
  const numero = Number(texto);
  if (numero < -100 || numero > 1000) {
    throw new NegocioError("El porcentaje tiene que estar entre -100 y 1000.");
  }
  return numero;
}

export function parseMargen(valor: unknown): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = parsePorcentaje(texto);
  if (numero < 0) throw new NegocioError("El margen máximo no puede ser negativo.");
  return numero;
}

/** Tope del precio propio. Null significa que no hay tope. */
export function topeMargen(precioCentral: number, margen: number | null): number | null {
  if (margen === null) return null;
  return Math.round(precioCentral * (1 + margen / 100) * 100) / 100;
}

export function precioDentroDeMargen(propio: number, central: number, margen: number | null): boolean {
  if (propio < 0) return false;
  const tope = topeMargen(central, margen);
  if (tope === null) return true;
  return propio <= tope;
}

export function parseNombreProducto(valor: unknown): string {
  const nombre = String(valor ?? "").trim();
  if (nombre.length < 2 || nombre.length > 120) {
    throw new NegocioError("Escribe el nombre del producto.");
  }
  return nombre;
}

export function parseDescripcion(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length > 500) throw new NegocioError("La descripción es demasiado larga.");
  return texto;
}

export function parseNombreCategoria(valor: unknown): string {
  const nombre = String(valor ?? "").trim();
  if (nombre.length < 2 || nombre.length > 80) {
    throw new NegocioError("Escribe el nombre de la categoría.");
  }
  return nombre;
}

export function parseIdsProducto(valores: readonly FormDataEntryValue[]): string[] {
  const ids = [...new Set(valores.map((valor) => String(valor)))];
  if (ids.some((id) => !esUuid(id))) {
    throw new NegocioError("La sucursal no pertenece a la tienda.");
  }
  return ids;
}

export function precioEfectivo(input: {
  activo: boolean;
  disponible: boolean;
  usaPrecioCentral: boolean;
  precioCentral: number;
  precioPropio: number | null;
  permitenPrecioPropio: boolean;
}): number | null {
  if (!input.activo || !input.disponible) return null;
  if (input.usaPrecioCentral || !input.permitenPrecioPropio) return input.precioCentral;
  return input.precioPropio;
}
