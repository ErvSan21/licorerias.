import { AccesoError, estadoHttp, mensajeAcceso } from "@/lib/auth/errors";
import { requireSuperAdmin } from "@/lib/auth/staff";

export async function GET() {
  try {
    await requireSuperAdmin();
    return Response.json(
      { superAdmin: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AccesoError) {
      return Response.json(
        { error: mensajeAcceso(error.codigo) },
        {
          status: estadoHttp(error.codigo),
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }

    console.error(error);
    return Response.json(
      { error: "No se pudo completar la solicitud." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
