/** Duraciones y curva usadas por CSS (`src/app/ui.css`) y por los tiempos en JS. */
export const duraciones = {
  rapida: 150,
  media: 250,
  lenta: 400,
} as const;

export const easing = "cubic-bezier(0.2, 0, 0, 1)";

/** No mostrar un loader si la carga termina antes de esto. */
export const esperaLoaderMs = duraciones.rapida;

/** Una vez visible, el loader permanece al menos este tiempo. */
export const minimoLoaderMs = 300;

/** El check de éxito del botón se mantiene este tiempo. */
export const exitoMs = 1200;

export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}

export function colorTextoSobre(hex: string): string {
  const limpio = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return "#fafafa";
  const rojo = Number.parseInt(limpio.slice(0, 2), 16);
  const verde = Number.parseInt(limpio.slice(2, 4), 16);
  const azul = Number.parseInt(limpio.slice(4, 6), 16);
  const luminancia = (rojo * 299 + verde * 587 + azul * 114) / 1000;
  return luminancia > 150 ? "#18181b" : "#fafafa";
}
