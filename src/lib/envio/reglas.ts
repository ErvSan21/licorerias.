import { NegocioError } from "@/lib/licencias/reglas";
import { capitalizar } from "@/lib/texto";

export { NegocioError };

export type Punto = { lat: number; lng: number };

export type TarifaRango = { hastaKm: number; costo: number };

export type ZonaReparto = {
  tipo: "tarifa_fija" | "bloqueada";
  lat: number;
  lng: number;
  radioKm: number;
  costo: number | null;
  activa: boolean;
};

const TIERRA_KM = 6371;

export function haversineKm(origen: Punto, destino: Punto): number {
  const lat1 = aRadianes(origen.lat);
  const lat2 = aRadianes(destino.lat);
  const dLat = aRadianes(destino.lat - origen.lat);
  const dLng = aRadianes(destino.lng - origen.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function elegirTarifa(distanciaKm: number, tarifas: readonly TarifaRango[]): number | null {
  let mejor: TarifaRango | null = null;
  for (const tarifa of tarifas) {
    if (tarifa.hastaKm < distanciaKm) continue;
    if (!mejor || tarifa.hastaKm < mejor.hastaKm) mejor = tarifa;
  }
  return mejor ? redondear(mejor.costo) : null;
}

export function resolverZona(
  destino: Punto,
  zonas: readonly ZonaReparto[],
): { tipo: "bloqueada" } | { tipo: "tarifa_fija"; costo: number; distanciaKm: number } | null {
  const contiene = zonas.filter(
    (zona) => zona.activa && haversineKm({ lat: zona.lat, lng: zona.lng }, destino) <= zona.radioKm,
  );
  if (contiene.some((zona) => zona.tipo === "bloqueada")) return { tipo: "bloqueada" };
  const fijas = contiene
    .filter((zona) => zona.tipo === "tarifa_fija" && zona.costo != null)
    .toSorted((a, b) => a.radioKm - b.radioKm);
  const fija = fijas[0];
  if (!fija || fija.costo == null) return null;
  return {
    tipo: "tarifa_fija",
    costo: redondear(fija.costo),
    distanciaKm: haversineKm({ lat: fija.lat, lng: fija.lng }, destino),
  };
}

export async function distanciaCalleOHaversine(
  origen: Punto,
  destino: Punto,
  fetcher: typeof fetch = fetch,
): Promise<{ km: number; metodo: "calle" | "haversine" }> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=false`;
  try {
    const respuesta = await fetcher(url, { signal: AbortSignal.timeout(5000) });
    if (!respuesta.ok) throw new Error("osrm");
    const cuerpo = (await respuesta.json()) as { code?: string; routes?: { distance?: number }[] };
    const metros = cuerpo.routes?.[0]?.distance;
    if (cuerpo.code !== "Ok" || typeof metros !== "number" || !Number.isFinite(metros)) {
      throw new Error("osrm");
    }
    return { km: metros / 1000, metodo: "calle" };
  } catch {
    return { km: haversineKm(origen, destino), metodo: "haversine" };
  }
}

export function parseCoordenadaCliente(lat: unknown, lng: unknown): Punto {
  const latitud = Number(lat);
  const longitud = Number(lng);
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    throw new NegocioError("La latitud tiene que estar entre -90 y 90.");
  }
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    throw new NegocioError("La longitud tiene que estar entre -180 y 180.");
  }
  return { lat: latitud, lng: longitud };
}

export function parseHastaKm(valor: unknown): number {
  const numero = numeroPositivo(valor, "El rango en kilómetros");
  if (numero > 999.9) throw new NegocioError("El rango en kilómetros es demasiado alto.");
  return Math.round(numero * 10) / 10;
}

export function parseCostoEnvio(valor: unknown): number {
  const numero = numeroNoNegativo(valor, "El costo");
  if (numero > 99_999_999.99) throw new NegocioError("El costo es demasiado alto.");
  return redondear(numero);
}

export function parseRadioKm(valor: unknown): number {
  const numero = numeroPositivo(valor, "El radio");
  if (numero > 999.9) throw new NegocioError("El radio es demasiado alto.");
  return Math.round(numero * 10) / 10;
}

export function parseNombreZona(valor: unknown): string {
  const nombre = String(valor ?? "").trim();
  if (nombre.length < 2 || nombre.length > 80) throw new NegocioError("Escribe el nombre de la zona.");
  return capitalizar(nombre);
}

export function parseTipoZona(valor: unknown): "tarifa_fija" | "bloqueada" {
  const tipo = String(valor ?? "");
  if (tipo !== "tarifa_fija" && tipo !== "bloqueada") {
    throw new NegocioError("El tipo de zona no es válido.");
  }
  return tipo;
}

const golpes = new Map<string, number[]>();

export function permitirIp(ip: string, ahora = Date.now(), maximo = 30, ventanaMs = 60_000): boolean {
  const previos = (golpes.get(ip) ?? []).filter((marca) => ahora - marca < ventanaMs);
  if (previos.length >= maximo) {
    golpes.set(ip, previos);
    return false;
  }
  previos.push(ahora);
  golpes.set(ip, previos);
  return true;
}

export function ipDeSolicitud(request: Request): string {
  const encabezado = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const primera = encabezado.split(",")[0]?.trim();
  return primera || "desconocida";
}

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function numeroPositivo(valor: unknown, etiqueta: string): number {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw new NegocioError(`${etiqueta} no es válido.`);
  const numero = Number(texto);
  if (numero <= 0) throw new NegocioError(`${etiqueta} tiene que ser mayor que cero.`);
  return numero;
}

function numeroNoNegativo(valor: unknown, etiqueta: string): number {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw new NegocioError(`${etiqueta} no es válido.`);
  return Number(texto);
}
