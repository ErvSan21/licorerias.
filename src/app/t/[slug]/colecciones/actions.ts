"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";
import { coleccionDesdeFormulario, guardarColeccion, guardarImagenColeccion } from "@/lib/ofertas/servicio";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarColeccionAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const id = await guardarColeccion(slug, coleccionDesdeFormulario(datos));
    const imagen = datos.get("imagen");
    if (imagen instanceof File && imagen.size > 0) {
      if (imagen.size > 2_000_000) throw new NegocioError("La imagen es demasiado grande.");
      if (!imagen.type.startsWith("image/")) throw new NegocioError("Elige una imagen.");
      await guardarImagenColeccion(slug, id, {
        bytes: new Uint8Array(await imagen.arrayBuffer()),
        tipo: imagen.type,
      });
    }
    revalidatePath(`/t/${slug}/colecciones`);
    return { ok: true, aviso: datos.get("id") ? "Colección actualizada." : "Colección creada." };
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
