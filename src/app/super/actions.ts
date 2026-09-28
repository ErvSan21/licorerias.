"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { mensajePublico } from "@/lib/licencias/http";
import {
  asignarLicencia,
  cambiarPlan,
  crearTienda,
  extenderLicencia,
  reactivarLicencia,
  registrarPago,
  suspenderLicencia,
} from "@/lib/licencias/servicio";

export type ResultadoAccion =
  | { ok: true; id?: string; aviso?: string }
  | { ok: false; error: string };

export async function crearTiendaAccion(input: {
  nombre: string;
  slug: string;
  planId: string;
  correoDueno: string;
  diasPrueba: string;
  diasGracia: string;
}): Promise<ResultadoAccion> {
  try {
    const origen = origenPedido(await headers());
    const diasPrueba = Number(input.diasPrueba);
    const diasGracia = Number(input.diasGracia);
    const creada = await crearTienda(
      {
        nombre: input.nombre,
        slug: input.slug,
        planId: input.planId,
        correoDueno: input.correoDueno,
        diasPrueba,
        diasGracia,
      },
      origen,
    );
    revalidatePath("/super");
    const aviso =
      creada.invitacion === "enviada"
        ? "Tienda creada. Se envió la invitación al dueño."
        : "Tienda creada. No se pudo enviar el correo: el dueño puede entrar con su cuenta o recuperar la contraseña.";
    return { ok: true, id: creada.id, aviso };
  } catch (error) {
    return fallar(error);
  }
}

export async function asignarLicenciaAccion(input: {
  tiendaId: string;
  planId: string;
  diasPrueba: string;
  diasGracia: string;
}): Promise<ResultadoAccion> {
  try {
    await asignarLicencia({
      tiendaId: input.tiendaId,
      planId: input.planId,
      diasPrueba: Number(input.diasPrueba),
      diasGracia: Number(input.diasGracia),
    });
    refrescar(input.tiendaId);
    return { ok: true, aviso: "Licencia de prueba asignada." };
  } catch (error) {
    return fallar(error);
  }
}

export async function cambiarPlanAccion(tiendaId: string, planId: string): Promise<ResultadoAccion> {
  try {
    await cambiarPlan(tiendaId, planId);
    refrescar(tiendaId);
    return { ok: true, aviso: "Plan actualizado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function extenderLicenciaAccion(tiendaId: string, vence: string): Promise<ResultadoAccion> {
  try {
    await extenderLicencia(tiendaId, vence);
    refrescar(tiendaId);
    return { ok: true, aviso: "Vencimiento actualizado." };
  } catch (error) {
    return fallar(error);
  }
}

export async function suspenderLicenciaAccion(tiendaId: string): Promise<ResultadoAccion> {
  try {
    await suspenderLicencia(tiendaId);
    refrescar(tiendaId);
    return { ok: true, aviso: "Licencia suspendida." };
  } catch (error) {
    return fallar(error);
  }
}

export async function reactivarLicenciaAccion(tiendaId: string): Promise<ResultadoAccion> {
  try {
    await reactivarLicencia(tiendaId);
    refrescar(tiendaId);
    return { ok: true, aviso: "Licencia reactivada." };
  } catch (error) {
    return fallar(error);
  }
}

export async function registrarPagoAccion(input: {
  tiendaId: string;
  monto: string;
  fecha: string;
  metodo: string;
  referencia: string;
  periodoDesde: string;
  periodoHasta: string;
}): Promise<ResultadoAccion> {
  try {
    await registrarPago(input);
    refrescar(input.tiendaId);
    return { ok: true, aviso: "Pago registrado." };
  } catch (error) {
    return fallar(error);
  }
}

function refrescar(tiendaId: string) {
  revalidatePath("/super");
  revalidatePath(`/super/tiendas/${tiendaId}`);
}

function origenPedido(cabeceras: Headers): string | null {
  return cabeceras.get("origin");
}

function fallar(error: unknown): ResultadoAccion {
  unstable_rethrow(error);
  console.error(error);
  return { ok: false, error: mensajePublico(error) };
}
