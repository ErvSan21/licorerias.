import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { cargarPanel } from "@/lib/auth/panel";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const { tienda, staff, vigente } = await cargarPanel(slug);
    return Response.json(
      {
        tienda: {
          id: tienda.id,
          slug: tienda.slug,
          nombre: tienda.nombre,
          estado: tienda.estado,
        },
        rol: staff.rol,
        licenciaVigente: vigente,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return responder(error);
  }
}

function responder(error: unknown): Response {
  if (error instanceof NoEncontrado) {
    return Response.json(
      { error: "No encontrado." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (error instanceof AccesoError) {
    return Response.json(
      { error: mensajeAcceso(error.codigo) },
      { status: estadoHttp(error.codigo), headers: { "Cache-Control": "private, no-store" } },
    );
  }

  console.error(error);
  return Response.json(
    { error: "No se pudo completar la solicitud." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}
