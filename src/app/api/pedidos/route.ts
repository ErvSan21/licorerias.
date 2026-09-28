import { permitirIp } from "@/lib/envio/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { limitarPublico, objetoSolicitud } from "@/lib/endurecimiento/solicitud";
import { pedidoDesdeJson } from "@/lib/pedidos/reglas";
import { crearPedidoPublico } from "@/lib/pedidos/servicio";

export async function POST(request: Request) {
  try {
    const frenado = limitarPublico(request, "pedido");
    if (frenado) return frenado;
    const cuerpo = await objetoSolicitud(request);
    const pedido = pedidoDesdeJson(cuerpo);
    if (!permitirIp(`tel:${pedido.telefono}`)) {
      return jsonPrivado({ error: "Demasiadas consultas. Espera un momento." }, 429);
    }
    const id = await crearPedidoPublico(pedido);
    return jsonPrivado({ id }, 201);
  } catch (error) {
    return responderEnvio(error);
  }
}
