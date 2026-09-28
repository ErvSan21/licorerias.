import { avisarPedido } from "@/lib/whatsapp";

/** Un fallo de WhatsApp nunca revierte el pedido ni el cambio de estado. */
export async function notificarEstado(pedidoId: string, estado: string): Promise<boolean> {
  try {
    return await avisarPedido(pedidoId, estado);
  } catch {
    return false;
  }
}
