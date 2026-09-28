"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";
import { cambiarEstadoPedido } from "@/lib/pedidos/servicio";

type Resultado = { ok: true; aviso: string } | { ok: false; error: string };

export async function cambiarEstadoAccion(slug: string, pedidoId: string, estado: string): Promise<Resultado> {
  try {
    await cambiarEstadoPedido(slug, pedidoId, estado);
    revalidatePath(`/t/${slug}/pedidos`);
    revalidatePath(`/t/${slug}/pedidos/${pedidoId}`);
    return { ok: true, aviso: "Estado actualizado." };
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
