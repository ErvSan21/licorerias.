"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import {
  bloquearUsuario,
  borrarUsuario,
  cambiarContrasenaUsuario,
  crearUsuarioOrganizacion,
  guardarPrecios,
  inactivarTienda,
} from "@/lib/administracion/servicio";
import { mensajePublico } from "@/lib/licencias/http";

export type ResultadoAccion = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarPreciosAccion(input: {
  mes: string;
  tresMeses: string;
  anio: string;
}): Promise<ResultadoAccion> {
  try {
    await guardarPrecios({
      mes: input.mes,
      tres_meses: input.tresMeses,
      anio: input.anio,
    });
    refrescar();
    return { ok: true, aviso: "Precios guardados." };
  } catch (error) {
    return fallar(error);
  }
}

export async function inactivarTiendaAccion(tiendaId: string): Promise<ResultadoAccion> {
  try {
    await inactivarTienda(tiendaId);
    refrescar();
    return { ok: true, aviso: "Tienda inactivada. El personal pierde el acceso de escritura." };
  } catch (error) {
    return fallar(error);
  }
}

export async function crearUsuarioAccion(input: {
  tiendaId: string;
  tipo: string;
  correo: string;
  contrasena: string;
}): Promise<ResultadoAccion> {
  try {
    await crearUsuarioOrganizacion(input);
    refrescar();
    return { ok: true, aviso: "Usuario creado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function bloquearUsuarioAccion(miembroId: string, bloquear: boolean): Promise<ResultadoAccion> {
  try {
    await bloquearUsuario(miembroId, bloquear);
    refrescar();
    return { ok: true, aviso: bloquear ? "Usuario bloqueado." : "Usuario desbloqueado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function borrarUsuarioAccion(miembroId: string): Promise<ResultadoAccion> {
  try {
    await borrarUsuario(miembroId);
    refrescar();
    return { ok: true, aviso: "Usuario borrado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function cambiarContrasenaAccion(miembroId: string, contrasena: string): Promise<ResultadoAccion> {
  try {
    await cambiarContrasenaUsuario(miembroId, contrasena);
    refrescar();
    return { ok: true, aviso: "Contraseña actualizada." };
  } catch (error) {
    return fallar(error);
  }
}

function refrescar() {
  revalidatePath("/administracion");
  revalidatePath("/administracion/tiendas");
  revalidatePath("/administracion/usuarios");
}

function fallar(error: unknown): ResultadoAccion {
  unstable_rethrow(error);
  console.error(error);
  return { ok: false, error: mensajePublico(error) };
}
