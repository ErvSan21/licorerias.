import { ipDeSolicitud, permitirIp } from "@/lib/envio/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { leerSeguimiento } from "@/lib/pedidos/servicio";
import { TiendaCerrada } from "@/lib/tienda/servicio";
import { normalizarSlug } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  try {
    const ip = ipDeSolicitud(request);
    if (!permitirIp(`seg:${ip}`)) {
      return jsonPrivado({ error: "Demasiadas consultas. Espera un momento." }, 429);
    }
    const pedido = await leerSeguimiento(normalizarSlug(slug), id);
    return jsonPrivado(pedido);
  } catch (error) {
    if (error instanceof TiendaCerrada) {
      return jsonPrivado({ error: "Tienda no disponible." }, 403);
    }
    return responderEnvio(error);
  }
}
