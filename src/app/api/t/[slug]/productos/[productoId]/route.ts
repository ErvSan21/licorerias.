import {
  actualizarProducto,
  archivoImagen,
  altaDesdeFormulario,
  eliminarProducto,
  guardarPrecioCentral,
  leerProducto,
} from "@/lib/catalogo/servicio";
import { parsePrecio } from "@/lib/catalogo/reglas";
import { jsonPrivado, responderCatalogo } from "@/lib/catalogo/http";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; productoId: string }> }) {
  const { slug, productoId } = await params;
  try {
    const { producto } = await leerProducto(slug, productoId);
    return jsonPrivado({ producto });
  } catch (error) {
    return responderCatalogo(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; productoId: string }> }) {
  const { slug, productoId } = await params;
  try {
    const tipo = request.headers.get("content-type") ?? "";
    if (tipo.includes("application/json")) {
      const cuerpo = (await request.json()) as { precio?: unknown };
      await guardarPrecioCentral(slug, productoId, parsePrecio(cuerpo.precio));
      return jsonPrivado({ ok: true });
    }
    const datos = await request.formData();
    await actualizarProducto(slug, productoId, altaDesdeFormulario(datos), await archivoImagen(datos));
    return jsonPrivado({ ok: true });
  } catch (error) {
    return responderCatalogo(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; productoId: string }> }) {
  const { slug, productoId } = await params;
  try {
    await eliminarProducto(slug, productoId);
    return jsonPrivado({ ok: true });
  } catch (error) {
    return responderCatalogo(error);
  }
}
