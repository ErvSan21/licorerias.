import { crearCategoria, listarCatalogo } from "@/lib/catalogo/servicio";
import { jsonPrivado, responderCatalogo } from "@/lib/catalogo/http";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const catalogo = await listarCatalogo(slug);
    return jsonPrivado({ categorias: catalogo.categorias });
  } catch (error) {
    return responderCatalogo(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = (await request.json()) as { nombre?: unknown };
    const id = await crearCategoria(slug, String(cuerpo.nombre ?? ""));
    return jsonPrivado({ id }, 201);
  } catch (error) {
    return responderCatalogo(error);
  }
}
