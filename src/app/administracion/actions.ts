"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import {
  bloquearUsuario,
  borrarUsuario,
  cambiarContrasenaUsuario,
  crearUsuarioOrganizacion,
  eliminarTienda,
  guardarPrecios,
  inactivarTienda,
} from "@/lib/administracion/servicio";
import { mensajePublico } from "@/lib/licencias/http";
import { guardarPlazoTienda } from "@/lib/licencias/servicio";
import {
  enviarPruebaTienda,
  guardarCredencialTienda,
  leerWhatsappTienda,
  type WhatsappTienda,
} from "@/lib/whatsapp";

export type ResultadoAccion = { ok: true; aviso: string } | { ok: false; error: string };

export async function guardarPreciosAccion(input: {
  mensual: string;
  trimestral: string;
  anual: string;
  demo: string;
}): Promise<ResultadoAccion> {
  try {
    await guardarPrecios({
      mensual: input.mensual,
      trimestral: input.trimestral,
      anual: input.anual,
      demo: input.demo,
    });
    refrescar();
    return { ok: true, aviso: "Precios guardados." };
  } catch (error) {
    return fallar(error);
  }
}

export async function eliminarTiendaAccion(tiendaId: string): Promise<ResultadoAccion> {
  try {
    await eliminarTienda(tiendaId);
    refrescar();
    return { ok: true, aviso: "Tienda eliminada." };
  } catch (error) {
    return fallar(error);
  }
}

export async function guardarPlazoAccion(input: {
  tiendaId: string;
  plazo: string;
  vence: string | null;
}): Promise<ResultadoAccion> {
  try {
    await guardarPlazoTienda(input.tiendaId, input.plazo, input.vence);
    refrescar();
    return { ok: true, aviso: "Plan actualizado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function leerWhatsappAccion(
  tiendaId: string,
): Promise<{ ok: true; valor: WhatsappTienda } | { ok: false; error: string }> {
  try {
    return { ok: true, valor: await leerWhatsappTienda(tiendaId) };
  } catch (error) {
    return fallar(error);
  }
}

export async function guardarWhatsappAccion(
  tiendaId: string,
  input: {
    sucursalId: string | null;
    phoneNumberId: string;
    wabaId: string;
    token: string | null;
    activo: boolean;
  },
): Promise<{ ok: true; aviso: string; credenciales: WhatsappTienda["credenciales"] } | { ok: false; error: string }> {
  try {
    await guardarCredencialTienda(tiendaId, input);
    const valor = await leerWhatsappTienda(tiendaId);
    return { ok: true, aviso: "WhatsApp guardado.", credenciales: valor.credenciales };
  } catch (error) {
    return fallar(error);
  }
}

export async function probarWhatsappAccion(
  tiendaId: string,
  sucursalId: string | null,
  telefono: string,
): Promise<ResultadoAccion> {
  try {
    await enviarPruebaTienda(tiendaId, sucursalId, telefono);
    return { ok: true, aviso: "Mensaje de prueba enviado." };
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

function fallar(error: unknown): { ok: false; error: string } {
  unstable_rethrow(error);
  console.error(error);
  return { ok: false, error: mensajePublico(error) };
}
