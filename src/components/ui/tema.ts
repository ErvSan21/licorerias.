import type { CSSProperties } from "react";

/** Giro del matiz para derivar el segundo color de marca. No se guarda. */
const GIRO_MATIZ = 35;
const BAJA_LUMINOSIDAD = 8;
const CONTRASTE_BLANCO = 4.5;
const BLANCO = "#ffffff";

type Hsl = { h: number; s: number; l: number };

export function hexValido(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor);
}

function limitar(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

function hexARgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16) / 255,
    g: Number.parseInt(hex.slice(3, 5), 16) / 255,
    b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function rgbAHex(r: number, g: number, b: number): string {
  const canal = (c: number) =>
    Math.round(limitar(c, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

export function hexAHsl(hex: string): Hsl {
  const { r, g, b } = hexARgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}

export function hslAHex(h: number, s: number, l: number): string {
  const sat = limitar(s, 0, 100) / 100;
  const lig = limitar(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((((h % 360) + 360) % 360) / 60);
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return rgbAHex(r + m, g + m, b + m);
}

function canalLineal(valor: number): number {
  return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const { r, g, b } = hexARgb(hex);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

export function contraste(fondo: string, texto: string): number {
  const a = luminancia(fondo);
  const b = luminancia(texto);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

function mezclar(a: string, b: string): string {
  const aa = hexARgb(a);
  const bb = hexARgb(b);
  return rgbAHex((aa.r + bb.r) / 2, (aa.g + bb.g) / 2, (aa.b + bb.b) / 2);
}

/** Segundo color: +35° de matiz y un poco menos de luminosidad. */
export function colorSecundario(primario: string): string {
  const { h, s, l } = hexAHsl(primario);
  return hslAHex((h + GIRO_MATIZ) % 360, s, Math.max(8, l - BAJA_LUMINOSIDAD));
}

function oscurecer(hex: string, puntos: number): string {
  const { h, s, l } = hexAHsl(hex);
  return hslAHex(h, s, Math.max(8, l - puntos));
}

/** Blanco sobre los extremos y el punto medio del degradado. */
export function degradadoLegible(br: string, br2: string): boolean {
  return [br, br2, mezclar(br, br2)].every((color) => contraste(color, BLANCO) >= CONTRASTE_BLANCO);
}

/**
 * --br sale de color_primario. --br2 se deriva. Si el blanco no contrasta
 * sobre el degradado, se oscurecen los colores inyectados (no el valor guardado).
 */
export function parejaMarca(color: string): { br: string; br2: string } | null {
  if (!hexValido(color)) return null;
  let br = color.toLowerCase();
  for (let paso = 0; paso < 18; paso += 1) {
    const br2 = colorSecundario(br);
    if (degradadoLegible(br, br2)) return { br, br2 };
    br = oscurecer(br, 4);
  }
  return { br, br2: colorSecundario(br) };
}

export function estiloMarca(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  const pareja = parejaMarca(color);
  if (!pareja) return undefined;
  return {
    ["--br" as string]: pareja.br,
    ["--br2" as string]: pareja.br2,
    // --gr se calcula en :root; sin redefinirlo aquí los botones quedarían con el color por defecto.
    ["--gr" as string]: `linear-gradient(135deg, ${pareja.br}, ${pareja.br2})`,
    ["--color-primario" as string]: pareja.br,
    ["--color-sobre-primario" as string]: BLANCO,
  };
}
