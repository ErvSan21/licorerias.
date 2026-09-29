"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso } from "@/lib/auth/errors";
import { mensajePublico } from "@/lib/licencias/http";
import { NegocioError } from "@/lib/licencias/reglas";
import { guardarCatalogoCentral } from "@/lib/sucursales/ajustes";
import { guardarSeleccion } from "@/lib/sucursales/seleccion";
import {
  actualizarPersonal,
  actualizarSucursal,
  altaDesdeFormulario,
  cambiarAbierta,
  cambiarContrasenaPersonal,
  cambiarDelivery,
  crearPersonal,
  crearSucursal,
  desactivarSucursal,
  eliminarPersonal,
  guardarUbicacionSucursal,
  listarSucursalesVisibles,
  suspenderPersonal,
} from "@/lib/sucursales/servicio";
import { esUuid } from "@/lib/licencias/reglas";

type Resultado = { ok: true; aviso: string; id?: string } | { ok: false; error: string };

export async function elegirSucursalAccion(datos: FormData): Promise<void> {
  const slug = String(datos.get("slug") ?? "");
  const valor = String(datos.get("sucursal") ?? "");
  const { staff, sucursales } = await listarSucursalesVisibles(slug);
  if (valor === "todas") {
    if (staff.rol !== "dueno") return;
    await guardarSeleccion(staff.tiendaId, "todas");
  } else if (esUuid(valor) && sucursales.some((sucursal) => sucursal.id === valor)) {
    await guardarSeleccion(staff.tiendaId, valor);
  }
  revalidatePath(`/t/${slug}`);
}

export async function crearSucursalAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const id = await crearSucursal(slug, altaDesdeFormulario(datos));
    revalidatePath(`/t/${slug}/sucursales`);
    return { ok: true, aviso: "Sucursal creada.", id };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarSucursalAccion(
  slug: string,
  sucursalId: string,
  datos: FormData,
): Promise<Resultado> {
  try {
    await actualizarSucursal(slug, sucursalId, {
      ...altaDesdeFormulario(datos),
      activa: datos.get("activa") === "on",
    });
    revalidatePath(`/t/${slug}/sucursales`);
    revalidatePath(`/t/${slug}/sucursales/${sucursalId}`);
    return { ok: true, aviso: "Sucursal guardada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function cambiarAbiertaAccion(
  slug: string,
  sucursalId: string,
  abierta: boolean,
): Promise<Resultado> {
  try {
    await cambiarAbierta(slug, sucursalId, abierta);
    revalidatePath(`/t/${slug}/sucursales`);
    return { ok: true, aviso: abierta ? "Sucursal abierta." : "Sucursal cerrada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function cambiarDeliveryAccion(slug: string, sucursalId: string, activo: boolean): Promise<Resultado> {
  try {
    await cambiarDelivery(slug, sucursalId, activo);
    revalidatePath(`/t/${slug}/configuracion/envio`);
    revalidatePath(`/t/${slug}/ventas`);
    revalidatePath(`/t/${slug}/sucursales/${sucursalId}`);
    return { ok: true, aviso: activo ? "Delivery activado." : "Delivery desactivado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarCatalogoCentralAccion(slug: string, activo: boolean): Promise<Resultado> {
  try {
    await guardarCatalogoCentral(slug, activo);
    revalidatePath(`/t/${slug}/sucursales`);
    revalidatePath(`/t/${slug}/productos`);
    revalidatePath(`/t/${slug}/ventas`);
    return {
      ok: true,
      aviso: activo
        ? "Las sucursales muestran los productos de la central."
        : "Cada sucursal elige sus productos.",
    };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarUbicacionAccion(
  slug: string,
  sucursalId: string,
  entrada: { punto: { lat: number; lng: number } } | { enlace: string },
): Promise<{ ok: true; aviso: string; punto: { lat: number; lng: number } } | { ok: false; error: string }> {
  try {
    const punto = await guardarUbicacionSucursal(slug, sucursalId, entrada);
    revalidatePath(`/t/${slug}/configuracion/envio`);
    revalidatePath(`/t/${slug}/sucursales`);
    return { ok: true, aviso: "Ubicación guardada.", punto };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function desactivarSucursalAccion(slug: string, sucursalId: string): Promise<Resultado> {
  try {
    await desactivarSucursal(slug, sucursalId);
    revalidatePath(`/t/${slug}/sucursales`);
    return { ok: true, aviso: "Sucursal desactivada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function crearPersonalAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const resultado = await crearPersonal(slug, {
      nombre: String(datos.get("nombre") ?? ""),
      apellido: String(datos.get("apellido") ?? ""),
      correo: String(datos.get("correo") ?? ""),
      celular: String(datos.get("celular") ?? ""),
      contrasena: String(datos.get("contrasena") ?? ""),
      rol: String(datos.get("rol") ?? ""),
      sucursalIds: datos.getAll("sucursalId").map(String),
    });
    revalidatePath(`/t/${slug}/personal`);
    return { ok: true, aviso: resultado.aviso };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function suspenderPersonalAccion(slug: string, miembroId: string, suspender: boolean): Promise<Resultado> {
  try {
    await suspenderPersonal(slug, miembroId, suspender);
    revalidatePath(`/t/${slug}/personal`);
    return { ok: true, aviso: suspender ? "Usuario suspendido." : "Usuario reactivado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function eliminarPersonalAccion(slug: string, miembroId: string): Promise<Resultado> {
  try {
    await eliminarPersonal(slug, miembroId);
    revalidatePath(`/t/${slug}/personal`);
    return { ok: true, aviso: "Usuario eliminado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function cambiarContrasenaPersonalAccion(
  slug: string,
  miembroId: string,
  contrasena: string,
): Promise<Resultado> {
  try {
    await cambiarContrasenaPersonal(slug, miembroId, contrasena);
    return { ok: true, aviso: "Contraseña actualizada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarPersonalAccion(slug: string, miembroId: string, datos: FormData): Promise<Resultado> {
  try {
    await actualizarPersonal(slug, miembroId, {
      rol: String(datos.get("rol") ?? ""),
      sucursalIds: datos.getAll("sucursalId").map(String),
      activo: datos.get("activo") !== "off",
    });
    revalidatePath(`/t/${slug}/personal`);
    return { ok: true, aviso: "Personal actualizado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

function mensaje(error: unknown): string {
  if (error instanceof AccesoError) return mensajeAcceso(error.codigo);
  if (error instanceof NegocioError) return error.message;
  return mensajePublico(error);
}
