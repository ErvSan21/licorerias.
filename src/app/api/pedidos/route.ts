import { ipDeSolicitud, permitirIp } from "@/lib/envio/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { NegocioError } from "@/lib/pedidos/reglas";
import { crearPedidoPublico, pedidoDesdeJson } from "@/lib/pedidos/servicio";

export async function POST(request: Request) {
  try {
    const ip = ipDeSolicitud(request);
    if (!permitirIp(ip)) {
      return jsonPrivado({ error: "Demasiadas consultas. Espera un momento." }, 429);
    }
    const cuerpo = await leerCuerpo(request);
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

async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    return datos as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NegocioError) throw error;
    throw new NegocioError("La solicitud no es válida.");
  }
}
