import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderEnvio } from "@/lib/envio/http";
import {
  parseCostoEnvio,
  parseCoordenadaCliente,
  parseNombreZona,
  parseRadioKm,
  parseTipoZona,
} from "@/lib/envio/reglas";
import { eliminarZona, guardarZona, listarEnvio } from "@/lib/envio/servicio";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const lista = await listarEnvio(slug);
    return jsonPrivado({ zonas: lista.zonas, sucursales: lista.sucursales });
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
      await eliminarZona(slug, uuid(cuerpo.id), sucursalId);
      return jsonPrivado({ ok: true });
    }
    const tipo = parseTipoZona(cuerpo.tipo);
    const punto = parseCoordenadaCliente(cuerpo.lat, cuerpo.lng);
    const id = await guardarZona(slug, {
      id: cuerpo.id ? uuid(cuerpo.id) : null,
      sucursalId,
      nombre: parseNombreZona(cuerpo.nombre),
      lat: punto.lat,
      lng: punto.lng,
      radioKm: parseRadioKm(cuerpo.radioKm),
      tipo,
      costo: tipo === "bloqueada" ? null : parseCostoEnvio(cuerpo.costo),
      activa: cuerpo.activa !== false,
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
