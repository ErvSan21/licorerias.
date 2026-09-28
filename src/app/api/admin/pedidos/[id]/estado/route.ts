import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { NegocioError } from "@/lib/pedidos/reglas";
import { cambiarEstadoPedido } from "@/lib/pedidos/servicio";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const cuerpo = await leerCuerpo(request);
    const slug = String(cuerpo.slug ?? "");
    if (!slug) throw new NegocioError("La solicitud no es válida.");
    const whatsappOk = await cambiarEstadoPedido(slug, id, String(cuerpo.estado ?? ""));
    return jsonPrivado({ ok: true, whatsappOk });
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
