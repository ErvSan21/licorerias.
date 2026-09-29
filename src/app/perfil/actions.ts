"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";
import { guardarMiPerfil } from "@/lib/perfil/servicio";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarPerfilAccion(input: {
  nombre: string;
  apellido: string;
  celular: string;
}): Promise<Resultado> {
  try {
    await guardarMiPerfil(input);
    revalidatePath("/", "layout");
    return { ok: true, aviso: "Perfil guardado." };
  } catch (error) {
    if (error instanceof NegocioError) return { ok: false, error: error.message };
    if (error instanceof AccesoError) return { ok: false, error: mensajeAcceso(error.codigo) };
    console.error(error);
    return { ok: false, error: "No se pudo guardar el perfil. Inténtalo de nuevo." };
  }
}
