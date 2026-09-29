"use server";

import { revalidatePath } from "next/cache";

import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";
import { parseMetodoPago, pedidoDesdeJson, referenciaPedido } from "@/lib/pedidos/reglas";
import { crearPedidoPersonal } from "@/lib/pedidos/servicio";

type Resultado = { ok: true; id: string; referencia: string } | { ok: false; error: string };

export async function crearVentaAccion(slug: string, cuerpo: Record<string, unknown>): Promise<Resultado> {
  try {
    const metodoPago = parseMetodoPago(cuerpo.metodoPago);
    const id = await crearPedidoPersonal(slug, pedidoDesdeJson(cuerpo), metodoPago);
    revalidatePath(`/t/${slug}/pedidos`);
    revalidatePath(`/t/${slug}/panel`);
    revalidatePath(`/t/${slug}/ventas`);
    return { ok: true, id, referencia: referenciaPedido(id) };
  } catch (error) {
    if (error instanceof NegocioError) return { ok: false, error: error.message };
    if (error instanceof AccesoError) return { ok: false, error: mensajeAcceso(error.codigo) };
    if (error instanceof NoEncontrado) return { ok: false, error: "No encontrado." };
    console.error(error);
    return { ok: false, error: "No se pudo registrar el pedido. Inténtalo de nuevo." };
  }
}
