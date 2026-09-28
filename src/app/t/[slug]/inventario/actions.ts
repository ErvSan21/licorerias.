"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import {
  ajustarStockAbsoluto,
  ajusteDesdeFormulario,
  fijarMinimo,
  importarCsv,
  minimoDesdeFormulario,
  reponerDesdeFormulario,
  reponerStock,
  transferenciaDesdeFormulario,
  transferirStock,
} from "@/lib/inventario/servicio";
import { NegocioError } from "@/lib/licencias/reglas";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function reponerAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await reponerStock(slug, reponerDesdeFormulario(datos));
    revalidar(slug);
    return { ok: true, aviso: "Stock repuesto." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function ajustarAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await ajustarStockAbsoluto(slug, ajusteDesdeFormulario(datos));
    revalidar(slug);
    return { ok: true, aviso: "Stock ajustado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function minimoAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await fijarMinimo(slug, minimoDesdeFormulario(datos));
    revalidar(slug);
    return { ok: true, aviso: "Mínimo guardado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function transferirAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await transferirStock(slug, transferenciaDesdeFormulario(datos));
    revalidar(slug);
    return { ok: true, aviso: "Transferencia hecha." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function importarAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      throw new NegocioError("Elige un archivo CSV.");
    }
    if (archivo.size > 1_000_000) throw new NegocioError("El archivo es demasiado grande.");
    const filas = await importarCsv(slug, await archivo.text());
    revalidar(slug);
    return { ok: true, aviso: `Se importaron ${filas} filas.` };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

function revalidar(slug: string) {
  revalidatePath(`/t/${slug}/inventario`);
}

function mensaje(error: unknown): string {
  if (error instanceof NegocioError) return error.message;
  if (error instanceof AccesoError) return mensajeAcceso(error.codigo);
  if (error instanceof NoEncontrado) return "No encontrado.";
  return "No se pudo completar. Inténtalo de nuevo.";
}
