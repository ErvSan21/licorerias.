import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { enviarPrueba } from "@/lib/whatsapp";
import { NegocioError } from "@/lib/whatsapp/reglas";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    const cuerpo = datos as { sucursalId?: unknown; telefono?: unknown };
    await enviarPrueba(slug, cuerpo.sucursalId ? String(cuerpo.sucursalId) : null, String(cuerpo.telefono ?? ""));
    return Response.json({ ok: true }, { headers: PRIVADO });
  } catch (error) {
    if (error instanceof NoEncontrado) {
      return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
    }
    if (error instanceof AccesoError) {
      return Response.json({ error: mensajeAcceso(error.codigo) }, { status: estadoHttp(error.codigo), headers: PRIVADO });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "La solicitud no es válida." }, { status: 400, headers: PRIVADO });
    }
    return responderError(error);
  }
}
