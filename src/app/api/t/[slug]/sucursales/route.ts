import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { altaDesdeFormulario, crearSucursal, listarSucursalesVisibles } from "@/lib/sucursales/servicio";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { sucursales } = await listarSucursalesVisibles(slug);
    return Response.json({ sucursales }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.formData();
    const id = await crearSucursal(slug, altaDesdeFormulario(datos));
    return Response.json({ id }, { status: 201, headers: PRIVADO });
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
