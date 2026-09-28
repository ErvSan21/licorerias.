import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import {
  altaDesdeFormulario,
  actualizarSucursal,
  cambiarAbierta,
  desactivarSucursal,
  leerSucursal,
} from "@/lib/sucursales/servicio";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; sucursalId: string }> },
) {
  const { slug, sucursalId } = await params;
  try {
    const { sucursal } = await leerSucursal(slug, sucursalId);
    return Response.json({ sucursal }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; sucursalId: string }> },
) {
  const { slug, sucursalId } = await params;
  try {
    const tipo = request.headers.get("content-type") ?? "";
    if (tipo.includes("application/json")) {
      const cuerpo = (await request.json()) as { accion?: string; abierta?: boolean };
      if (cuerpo.accion === "abierta") {
        const abierta = await cambiarAbierta(slug, sucursalId, cuerpo.abierta === true);
        return Response.json({ abierta }, { headers: PRIVADO });
      }
      if (cuerpo.accion === "desactivar") {
        await desactivarSucursal(slug, sucursalId);
        return Response.json({ activa: false }, { headers: PRIVADO });
      }
    }
    const datos = await request.formData();
    await actualizarSucursal(slug, sucursalId, {
      ...altaDesdeFormulario(datos),
      activa: datos.get("activa") === "on",
    });
    return Response.json({ ok: true }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
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
