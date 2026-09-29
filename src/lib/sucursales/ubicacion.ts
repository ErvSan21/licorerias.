/** Punto con 6 decimales (unos 10 cm), como guarda el mapa. */
export type Punto = { lat: number; lng: number };

/** Enlaces cortos de Google Maps: hay que seguir la redirección para ver las coordenadas. */
const HOSTS_CORTOS = new Set(["maps.app.goo.gl", "goo.gl"]);

export function esEnlaceCorto(texto: string): boolean {
  try {
    const url = new URL(texto.trim());
    return url.protocol === "https:" && HOSTS_CORTOS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Coordenadas desde un link de Google Maps o desde "lat, lng" escrito a mano.
 * Formatos: !3d<lat>!4d<lng> (lugar), @lat,lng (vista), ?q= / query= / ll= / destination=.
 * Devuelve null si no encuentra un punto válido.
 */
export function coordenadasDesdeTexto(texto: string): Punto | null {
  const limpio = decodeURIComponent(texto.trim().replace(/\+/g, " "));
  const numero = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patrones = [
    new RegExp(`!3d${numero}!4d${numero}`),
    new RegExp(`@${numero},\\s*${numero}`),
    new RegExp(`[?&](?:q|query|ll|destination|center)=(?:loc:)?${numero},\\s*${numero}`),
    new RegExp(`^${numero}\\s*,\\s*${numero}$`),
  ];
  for (const patron of patrones) {
    const coincidencia = patron.exec(limpio);
    if (!coincidencia) continue;
    const punto = { lat: Number(coincidencia[1]), lng: Number(coincidencia[2]) };
    if (esPuntoValido(punto)) return redondear(punto);
  }
  return null;
}

export function esPuntoValido(punto: Punto): boolean {
  return (
    Number.isFinite(punto.lat) &&
    Number.isFinite(punto.lng) &&
    Math.abs(punto.lat) <= 90 &&
    Math.abs(punto.lng) <= 180 &&
    !(punto.lat === 0 && punto.lng === 0)
  );
}

function redondear(punto: Punto): Punto {
  return { lat: Number(punto.lat.toFixed(6)), lng: Number(punto.lng.toFixed(6)) };
}
