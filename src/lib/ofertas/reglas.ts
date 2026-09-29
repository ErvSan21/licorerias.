import { fechaValida, NegocioError } from "@/lib/licencias/reglas";
import { capitalizar } from "@/lib/texto";

export { NegocioError };

export const TIPOS_OFERTA = ["precio_fijo", "porcentaje"] as const;
export type TipoOferta = (typeof TIPOS_OFERTA)[number];

export const ESTADOS_OFERTA = ["vigente", "programada", "vencida", "inactiva"] as const;
export type EstadoOferta = (typeof ESTADOS_OFERTA)[number];

export type OrigenPrecio = "central" | "propio" | "oferta";

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

const partesBolivia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function etiquetaEstado(estado: EstadoOferta): string {
  if (estado === "vigente") return "Vigente";
  if (estado === "programada") return "Programada";
  if (estado === "vencida") return "Vencida";
  return "Inactiva";
}

export function etiquetaTipo(tipo: TipoOferta): string {
  return tipo === "precio_fijo" ? "Precio fijo" : "Porcentaje";
}

export function aTimestamptzBolivia(valor: string): string {
  const coincidencia = LOCAL.exec(String(valor ?? "").trim());
  if (!coincidencia || !fechaValida(coincidencia[1])) {
    throw new NegocioError("Escribe la fecha y la hora.");
  }
  const hora = Number(coincidencia[2]);
  const minuto = Number(coincidencia[3]);
  if (hora > 23 || minuto > 59) throw new NegocioError("Escribe la fecha y la hora.");
  return `${coincidencia[1]}T${coincidencia[2]}:${coincidencia[3]}:00-04:00`;
}

export function campoFechaBolivia(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = new Map(partesBolivia.formatToParts(fecha).map((parte) => [parte.type, parte.value]));
  return `${partes.get("year")}-${partes.get("month")}-${partes.get("day")}T${partes.get("hour")}:${partes.get("minute")}`;
}

export function rangoValido(inicioIso: string, finIso: string): void {
  const inicio = new Date(inicioIso);
  const fin = new Date(finIso);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    throw new NegocioError("La fecha de fin tiene que ser posterior al inicio.");
  }
}

export function estadoOferta(input: {
  inicio: string;
  fin: string;
  activa: boolean;
  ahora?: Date;
}): EstadoOferta {
  if (!input.activa) return "inactiva";
  const ahora = input.ahora ?? new Date();
  const inicio = new Date(input.inicio).getTime();
  const fin = new Date(input.fin).getTime();
  if (ahora.getTime() < inicio) return "programada";
  if (ahora.getTime() >= fin) return "vencida";
  return "vigente";
}

/** Misma regla que precio_vigente: gana la oferta con el menor precio final. */
export function precioConOfertas(input: {
  base: number;
  origenBase: "central" | "propio";
  ofertas: readonly { tipo: TipoOferta; valor: number }[];
}): { precioOriginal: number; precioFinal: number; origen: OrigenPrecio } {
  let mejor = input.base;
  for (const oferta of input.ofertas) {
    const candidato =
      oferta.tipo === "porcentaje"
        ? Math.round(input.base * (100 - oferta.valor)) / 100
        : Math.round(oferta.valor * 100) / 100;
    if (candidato < mejor) mejor = candidato;
  }
  if (mejor < 0) mejor = 0;
  return {
    precioOriginal: input.base,
    precioFinal: mejor,
    origen: mejor < input.base ? "oferta" : input.origenBase,
  };
}

export function parseTipoOferta(valor: unknown): TipoOferta {
  const tipo = String(valor ?? "");
  if (tipo !== "precio_fijo" && tipo !== "porcentaje") {
    throw new NegocioError("El tipo de oferta no es válido.");
  }
  return tipo;
}

export function parseValorOferta(tipo: TipoOferta, valor: unknown): number {
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new NegocioError("Escribe el valor de la oferta.");
  }
  const numero = Number(texto);
  if (tipo === "porcentaje" && numero > 100) {
    throw new NegocioError("El porcentaje no puede pasar de 100.");
  }
  if (numero > 99_999_999.99) throw new NegocioError("El valor de la oferta es demasiado alto.");
  return numero;
}

export function parseNombreColeccion(valor: unknown): string {
  const nombre = String(valor ?? "").trim();
  if (nombre.length < 2 || nombre.length > 80) {
    throw new NegocioError("Escribe el nombre de la colección.");
  }
  return capitalizar(nombre);
}

export function parseDescripcionColeccion(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (texto.length > 400) throw new NegocioError("La descripción es demasiado larga.");
  return capitalizar(texto);
}
