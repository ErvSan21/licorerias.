import { calcularEnvio } from "@/lib/envio/servicio";
import { ipDeSolicitud, NegocioError, parseCoordenadaCliente, permitirIp } from "@/lib/envio/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { esUuid } from "@/lib/licencias/reglas";

export async function POST(request: Request) {
  try {
    if (!permitirIp(ipDeSolicitud(request))) {
      return jsonPrivado({ error: "Demasiadas consultas. Espera un momento." }, 429);
    }
    const cuerpo = await leerCuerpo(request);
    const sucursalId = String(cuerpo.sucursalId ?? "");
    if (!esUuid(sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
    const destino = parseCoordenadaCliente(cuerpo.lat, cuerpo.lng);
    const resultado = await calcularEnvio(sucursalId, destino);
    return jsonPrivado(resultado);
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
