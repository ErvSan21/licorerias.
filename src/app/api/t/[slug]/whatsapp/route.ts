import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { guardarCredencial, listarCredenciales } from "@/lib/whatsapp";
import { NegocioError } from "@/lib/whatsapp/reglas";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const credenciales = await listarCredenciales(slug);
    return Response.json({ credenciales }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = await leer(request);
    await guardarCredencial(slug, {
      sucursalId: cuerpo.sucursalId ? String(cuerpo.sucursalId) : null,
      phoneNumberId: String(cuerpo.phoneNumberId ?? ""),
      wabaId: String(cuerpo.wabaId ?? ""),
      token: cuerpo.token == null ? null : String(cuerpo.token),
      activo: cuerpo.activo !== false,
    });
    const credenciales = await listarCredenciales(slug);
    return Response.json({ credenciales }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
  }
}

async function leer(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) throw new NegocioError("La solicitud no es válida.");
    return datos as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NegocioError) throw error;
    throw new NegocioError("La solicitud no es válida.");
  }
}

function responder(error: unknown): Response {
  if (error instanceof NoEncontrado) {
    return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
  }
  if (error instanceof AccesoError) {
    return Response.json({ error: mensajeAcceso(error.codigo) }, { status: estadoHttp(error.codigo), headers: PRIVADO });
  }
  return responderError(error);
}
