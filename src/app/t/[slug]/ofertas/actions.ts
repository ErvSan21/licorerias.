"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";
import { guardarOferta, ofertaDesdeFormulario } from "@/lib/ofertas/servicio";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarOfertaAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    await guardarOferta(slug, ofertaDesdeFormulario(datos));
    revalidatePath(`/t/${slug}/ofertas`);
    return { ok: true, aviso: datos.get("id") ? "Oferta actualizada." : "Oferta creada." };
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
