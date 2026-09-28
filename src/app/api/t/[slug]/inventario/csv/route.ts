import { NegocioError } from "@/lib/licencias/reglas";
import { responderInventario, sucursalDeConsulta } from "@/lib/inventario/http";
import { exportarCsv, importarCsv } from "@/lib/inventario/servicio";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const csv = await exportarCsv(slug, sucursalDeConsulta(request.url));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inventario.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return responderInventario(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    const csv = String((datos as { csv?: unknown }).csv ?? "");
    const filas = await importarCsv(slug, csv);
    return Response.json(
      { filas },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return responderInventario(new NegocioError("La solicitud no es válida."));
    }
    return responderInventario(error);
  }
}
