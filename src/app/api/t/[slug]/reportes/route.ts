import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { responderError } from "@/lib/licencias/http";
import { csvReporte } from "@/lib/reportes/reglas";
import { leerReporte } from "@/lib/reportes/servicio";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  try {
    const contexto = await contextoPanel(slug);
    if (contexto.staff.rol === "vendedor") {
      return Response.json({ error: "No encontrado." }, { status: 404 });
    }
    const { reporte, desde, hasta } = await leerReporte(contexto.tienda.slug, contexto.sucursales.map((sucursal) => sucursal.id), {
      desde: url.searchParams.get("desde"),
      hasta: url.searchParams.get("hasta"),
      sucursal: url.searchParams.get("sucursal"),
    });
    return new Response(csvReporte(reporte), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="reporte-${desde}-${hasta}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof NoEncontrado) return Response.json({ error: "No encontrado." }, { status: 404 });
    if (error instanceof AccesoError) {
      return Response.json({ error: mensajeAcceso(error.codigo) }, { status: estadoHttp(error.codigo) });
    }
    return responderError(error);
  }
}
