import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { actualizarPersonal } from "@/lib/sucursales/servicio";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; miembroId: string }> },
) {
  const { slug, miembroId } = await params;
  try {
    const datos = await request.formData();
    await actualizarPersonal(slug, miembroId, {
      rol: String(datos.get("rol") ?? ""),
      sucursalIds: datos.getAll("sucursalId").map(String),
      activo: datos.get("activo") !== "off",
    });
    return Response.json({ ok: true }, { headers: PRIVADO });
  } catch (error) {
    if (error instanceof NoEncontrado) {
      return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
    }
    if (error instanceof AccesoError) {
      return Response.json(
        { error: mensajeAcceso(error.codigo) },
        { status: estadoHttp(error.codigo), headers: PRIVADO },
      );
    }
    return responderError(error);
  }
}
