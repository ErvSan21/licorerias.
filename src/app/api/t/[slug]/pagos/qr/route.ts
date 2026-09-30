import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { NegocioError } from "@/lib/licencias/reglas";
import { archivoMarca, guardarQrPago } from "@/lib/marca/servicio";

const PRIVADO = { "Cache-Control": "private, no-store" };

/** Sube o quita la imagen del QR de cobro. Solo el dueño. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.formData();
    const qrUrl = await guardarQrPago(slug, await archivoMarca(datos, "qr"), datos.get("quitar") === "1");
    return Response.json({ qrUrl }, { headers: PRIVADO });
  } catch (error) {
    if (error instanceof NegocioError) return responderError(error);
    if (error instanceof NoEncontrado) {
      return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
    }
    if (error instanceof AccesoError) {
      return Response.json({ error: mensajeAcceso(error.codigo) }, { status: estadoHttp(error.codigo), headers: PRIVADO });
    }
    return responderError(error);
  }
}
