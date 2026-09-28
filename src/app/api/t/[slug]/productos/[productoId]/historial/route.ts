import { listarHistorial } from "@/lib/catalogo/servicio";
import { jsonPrivado, responderCatalogo } from "@/lib/catalogo/http";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; productoId: string }> }) {
  const { slug, productoId } = await params;
  try {
    const { producto, historial } = await listarHistorial(slug, productoId);
    return jsonPrivado({ producto: { id: producto.id, nombre: producto.nombre }, historial });
  } catch (error) {
    return responderCatalogo(error);
  }
}
