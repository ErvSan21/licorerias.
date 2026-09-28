"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import {
  eliminarTarifa,
  eliminarZona,
  guardarTarifa,
  guardarZona,
  tarifaDesdeFormulario,
  zonaDesdeFormulario,
} from "@/lib/envio/servicio";
import { NegocioError } from "@/lib/licencias/reglas";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarTarifaAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await guardarTarifa(slug, tarifaDesdeFormulario(datos));
    revalidatePath(`/t/${slug}/envio`);
    return { ok: true, aviso: datos.get("id") ? "Tarifa actualizada." : "Tarifa creada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function eliminarTarifaAccion(slug: string, id: string, sucursalId: string): Promise<Resultado> {
  try {
    await eliminarTarifa(slug, id, sucursalId);
    revalidatePath(`/t/${slug}/envio`);
    return { ok: true, aviso: "Tarifa eliminada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarZonaAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await guardarZona(slug, zonaDesdeFormulario(datos));
    revalidatePath(`/t/${slug}/envio`);
    return { ok: true, aviso: datos.get("id") ? "Zona actualizada." : "Zona creada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function eliminarZonaAccion(slug: string, id: string, sucursalId: string): Promise<Resultado> {
  try {
    await eliminarZona(slug, id, sucursalId);
    revalidatePath(`/t/${slug}/envio`);
    return { ok: true, aviso: "Zona eliminada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

function mensaje(error: unknown): string {
  if (error instanceof NegocioError) return error.message;
  if (error instanceof AccesoError) return mensajeAcceso(error.codigo);
  if (error instanceof NoEncontrado) return "No encontrado.";
  return "No se pudo completar. Inténtalo de nuevo.";
}
