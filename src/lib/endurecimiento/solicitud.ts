import { ipDeSolicitud, permitirIp } from "@/lib/envio/reglas";
import { NegocioError } from "@/lib/licencias/reglas";

const PRIVADO = { "Cache-Control": "private, no-store" };

/** Rechaza cuerpos que no son un objeto JSON. El mismo texto en todas las rutas públicas. */
export async function objetoSolicitud(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos: unknown = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    return datos as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NegocioError) throw error;
    throw new NegocioError("La solicitud no es válida.");
  }
}

/** 30 solicitudes por minuto y por IP, con un cubo distinto por ruta. */
export function limitarPublico(request: Request, cubo: string): Response | null {
  const ip = ipDeSolicitud(request);
  if (!permitirIp(`${cubo}:${ip}`)) {
    return Response.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: PRIVADO },
    );
  }
  return null;
}
