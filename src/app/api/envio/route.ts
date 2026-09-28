import { limitarPublico, objetoSolicitud } from "@/lib/endurecimiento/solicitud";
import { calcularEnvio } from "@/lib/envio/servicio";
import { NegocioError, parseCoordenadaCliente } from "@/lib/envio/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { esUuid } from "@/lib/licencias/reglas";

export async function POST(request: Request) {
  try {
    const frenado = limitarPublico(request, "envio");
    if (frenado) return frenado;
    const cuerpo = await objetoSolicitud(request);
    const sucursalId = String(cuerpo.sucursalId ?? "");
    if (!esUuid(sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
    const destino = parseCoordenadaCliente(cuerpo.lat, cuerpo.lng);
    const resultado = await calcularEnvio(sucursalId, destino);
    return jsonPrivado(resultado);
  } catch (error) {
    return responderEnvio(error);
  }
}
