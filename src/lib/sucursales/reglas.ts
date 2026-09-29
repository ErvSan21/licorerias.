import { esUuid, NegocioError, parseCorreo } from "@/lib/licencias/reglas";
import { esRolTienda, slugReservado, slugValido, type RolTienda } from "@/lib/tenant";

export { NegocioError };

export const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type Dia = (typeof DIAS)[number];

export const ETIQUETA_DIA: Record<Dia, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

export type Franja = {
  abierto: boolean;
  desde: string;
  hasta: string;
};

export type Horario = Record<Dia, Franja>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horarioPorDefecto(): Horario {
  const abierto = (dia: Dia): Franja => ({
    abierto: dia !== "dom",
    desde: "09:00",
    hasta: "21:00",
  });
  return {
    lun: abierto("lun"),
    mar: abierto("mar"),
    mie: abierto("mie"),
    jue: abierto("jue"),
    vie: abierto("vie"),
    sab: abierto("sab"),
    dom: abierto("dom"),
  };
}

/** Abierta todos los días, todo el día. */
export function horarioTodoElDia(): Horario {
  const franja = (): Franja => ({ abierto: true, desde: "00:00", hasta: "23:59" });
  return {
    lun: franja(),
    mar: franja(),
    mie: franja(),
    jue: franja(),
    vie: franja(),
    sab: franja(),
    dom: franja(),
  };
}

export function parseHorario(valor: unknown): Horario {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new NegocioError("El horario no es válido.");
  }
  const origen = valor as Record<string, unknown>;
  const horario = horarioPorDefecto();
  for (const dia of DIAS) {
    const franja = origen[dia];
    if (!franja || typeof franja !== "object" || Array.isArray(franja)) {
      throw new NegocioError(`Falta el horario del ${ETIQUETA_DIA[dia].toLowerCase()}.`);
    }
    const fila = franja as Record<string, unknown>;
    const desde = String(fila.desde ?? "");
    const hasta = String(fila.hasta ?? "");
    if (!HORA.test(desde) || !HORA.test(hasta)) {
      throw new NegocioError(`La hora de ${ETIQUETA_DIA[dia].toLowerCase()} no es válida.`);
    }
    if (desde >= hasta) {
      throw new NegocioError(`${ETIQUETA_DIA[dia]} tiene que cerrar después de abrir.`);
    }
    horario[dia] = { abierto: fila.abierto === true || fila.abierto === "on", desde, hasta };
  }
  return horario;
}

export function parseTelefono(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  const digitos = limpio.replace(/\D/g, "");
  const local = digitos.startsWith("591") ? digitos.slice(3) : digitos;
  if (!/^[0-9]{8}$/.test(local)) {
    throw new NegocioError("El teléfono debe tener 8 dígitos de Bolivia.");
  }
  return `591${local}`;
}

export function formatoTelefono(valor: string | null): string {
  if (!valor) return "Sin teléfono";
  if (valor.startsWith("591") && valor.length === 11) return valor.slice(3);
  return valor;
}

export function parseSlugSucursal(valor: string): string {
  const slug = valor.trim().toLowerCase();
  if (!slugValido(slug) || slugReservado(slug) || slug === "nueva") {
    throw new NegocioError("El identificador solo puede usar minúsculas, números y guiones.");
  }
  return slug;
}

export function parseCoordenadas(lat: string, lng: string): { lat: number; lng: number } | null {
  const latLimpia = lat.trim();
  const lngLimpia = lng.trim();
  if (!latLimpia && !lngLimpia) return null;
  const latitud = Number(latLimpia);
  const longitud = Number(lngLimpia);
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    throw new NegocioError("La latitud tiene que estar entre -90 y 90.");
  }
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    throw new NegocioError("La longitud tiene que estar entre -180 y 180.");
  }
  return { lat: latitud, lng: longitud };
}

export function parseMinutos(valor: string): number {
  if (!/^\d+$/.test(valor.trim())) {
    throw new NegocioError("Los minutos de anticipación tienen que ser un número.");
  }
  const minutos = Number(valor);
  if (minutos < 0 || minutos > 240) {
    throw new NegocioError("La anticipación del recojo va de 0 a 240 minutos.");
  }
  return minutos;
}

export function accesoSucursal(rol: RolTienda, asignada: boolean): boolean {
  return rol === "dueno" || asignada;
}

export function parseRolPersonal(valor: string): RolTienda {
  if (!esRolTienda(valor)) throw new NegocioError("Elige un rol.");
  return valor;
}

export function parseIdsSucursal(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : typeof valor === "string" && valor ? valor.split(",") : [];
  const ids = lista.map((item) => String(item).trim()).filter(Boolean);
  if (ids.some((id) => !esUuid(id))) throw new NegocioError("Hay una sucursal que no es válida.");
  return [...new Set(ids)];
}

export function horarioDesdeFormulario(datos: FormData): Horario {
  const crudo: Record<string, { abierto: boolean; desde: string; hasta: string }> = {};
  for (const dia of DIAS) {
    crudo[dia] = {
      abierto: datos.get(`abierto-${dia}`) === "on",
      desde: String(datos.get(`desde-${dia}`) ?? ""),
      hasta: String(datos.get(`hasta-${dia}`) ?? ""),
    };
  }
  return parseHorario(crudo);
}

export { parseCorreo };
