import { colorTextoSobre } from "@/components/ui/tokens";
import { NegocioError } from "@/lib/licencias/reglas";

export const contrasteMinimo = 4.5;

export type MarcaPublica = {
  nombreComercial: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  bannerUrl: string | null;
  mensajeBienvenida: string | null;
};

export const marcaVacia: MarcaPublica = {
  nombreComercial: null,
  logoUrl: null,
  colorPrimario: null,
  bannerUrl: null,
  mensajeBienvenida: null,
};

function canal(valor: number): number {
  const s = valor / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace("#", "");
  const rojo = Number.parseInt(limpio.slice(0, 2), 16);
  const verde = Number.parseInt(limpio.slice(2, 4), 16);
  const azul = Number.parseInt(limpio.slice(4, 6), 16);
  return 0.2126 * canal(rojo) + 0.7152 * canal(verde) + 0.0722 * canal(azul);
}

export function contraste(fondo: string, texto: string): number {
  const a = luminancia(fondo);
  const b = luminancia(texto);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

export function contrasteSuficiente(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
  return contraste(hex, colorTextoSobre(hex)) >= contrasteMinimo;
}

export function parseNombreComercial(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (texto.length < 2 || texto.length > 60) {
    throw new NegocioError("El nombre comercial tiene que tener entre 2 y 60 caracteres.");
  }
  return texto;
}

export function parseColorMarca(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (!/^#[0-9A-Fa-f]{6}$/.test(texto)) throw new NegocioError("Escribe un color en formato #RRGGBB.");
  const color = texto.toLowerCase();
  if (!contrasteSuficiente(color)) {
    throw new NegocioError("Ese color no contrasta lo suficiente con el texto. Elige uno más claro o más oscuro.");
  }
  return color;
}

export function parseBienvenida(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (texto.length < 2 || texto.length > 280) {
    throw new NegocioError("El mensaje de bienvenida tiene que tener entre 2 y 280 caracteres.");
  }
  return texto;
}

export function marcaDesdeJson(valor: unknown): MarcaPublica {
  if (!valor || typeof valor !== "object") return marcaVacia;
  const fila = valor as Record<string, unknown>;
  return {
    nombreComercial: textoONulo(fila.nombreComercial),
    logoUrl: textoONulo(fila.logoUrl),
    colorPrimario: textoONulo(fila.colorPrimario),
    bannerUrl: textoONulo(fila.bannerUrl),
    mensajeBienvenida: textoONulo(fila.mensajeBienvenida),
  };
}

export function nombreVisible(marca: MarcaPublica, respaldo: string): string {
  return marca.nombreComercial || respaldo;
}

function textoONulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}
