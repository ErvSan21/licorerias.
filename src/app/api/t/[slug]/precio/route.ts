import { limitarPublico } from "@/lib/endurecimiento/solicitud";
import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderOfertas } from "@/lib/ofertas/http";
import { consultarPrecioVigente } from "@/lib/ofertas/servicio";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const frenado = limitarPublico(request, "precio");
    if (frenado) return frenado;
    const url = new URL(request.url);
    const productoId = url.searchParams.get("producto") ?? "";
    const sucursalId = url.searchParams.get("sucursal") ?? "";
    if (!esUuid(productoId) || !esUuid(sucursalId)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    const precio = await consultarPrecioVigente(slug, productoId, sucursalId);
    return jsonPrivado({ precio });
  } catch (error) {
    return responderOfertas(error);
  }
}
