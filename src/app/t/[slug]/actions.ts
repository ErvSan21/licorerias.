"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AccesoError, mensajeAcceso } from "@/lib/auth/errors";
import { mensajePublico } from "@/lib/licencias/http";
import { NegocioError } from "@/lib/licencias/reglas";
import { guardarSeleccion } from "@/lib/sucursales/seleccion";
import {
  actualizarPersonal,
  actualizarSucursal,
  altaDesdeFormulario,
  cambiarAbierta,
  crearSucursal,
  desactivarSucursal,
  invitarPersonal,
  listarSucursalesVisibles,
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

export async function desactivarSucursalAccion(slug: string, sucursalId: string): Promise<Resultado> {
  try {
    await desactivarSucursal(slug, sucursalId);
    revalidatePath(`/t/${slug}/sucursales`);
    return { ok: true, aviso: "Sucursal desactivada." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function invitarPersonalAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const cabeceras = await headers();
    const resultado = await invitarPersonal(
      slug,
      {
        correo: String(datos.get("correo") ?? ""),
        rol: String(datos.get("rol") ?? ""),
        sucursalIds: datos.getAll("sucursalId").map(String),
      },
      cabeceras.get("origin"),
    );
    revalidatePath(`/t/${slug}/personal`);
    return { ok: true, aviso: resultado.aviso };
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
