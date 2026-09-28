import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import { parseCostoEnvio, parseHastaKm } from "@/lib/envio/reglas";
import { eliminarTarifa, guardarTarifa, listarEnvio } from "@/lib/envio/servicio";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const lista = await listarEnvio(slug);
    return jsonPrivado({ tarifas: lista.tarifas, sucursales: lista.sucursales });
  } catch (error) {
    return responderEnvio(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = await leerCuerpo(request);
    const sucursalId = uuid(cuerpo.sucursalId);
    if (cuerpo.accion === "eliminar") {
      await eliminarTarifa(slug, uuid(cuerpo.id), sucursalId);
      return jsonPrivado({ ok: true });
    }
    const id = await guardarTarifa(slug, {
      id: cuerpo.id ? uuid(cuerpo.id) : null,
      sucursalId,
      hastaKm: parseHastaKm(cuerpo.hastaKm),
      costo: parseCostoEnvio(cuerpo.costo),
    });
    return jsonPrivado({ id });
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

function uuid(valor: unknown): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  return id;
}
