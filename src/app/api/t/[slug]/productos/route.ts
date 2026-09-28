import { archivoImagen, altaDesdeFormulario, crearProducto, listarCatalogo } from "@/lib/catalogo/servicio";
import { jsonPrivado, responderCatalogo, vistaCatalogo } from "@/lib/catalogo/http";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const catalogo = await listarCatalogo(slug);
    return jsonPrivado(vistaCatalogo(catalogo));
  } catch (error) {
    return responderCatalogo(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.formData();
    const id = await crearProducto(slug, altaDesdeFormulario(datos), await archivoImagen(datos));
    return jsonPrivado({ id }, 201);
  } catch (error) {
    return responderCatalogo(error);
  }
}
