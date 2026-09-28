import { NegocioError, esUuid } from "@/lib/licencias/reglas";
import { jsonPrivado, responderOfertas } from "@/lib/ofertas/http";
import {
  aTimestamptzBolivia,
  parseDescripcionColeccion,
  parseNombreColeccion,
  rangoValido,
} from "@/lib/ofertas/reglas";
import { guardarColeccion, listarColecciones } from "@/lib/ofertas/servicio";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    return jsonPrivado(await listarColecciones(slug));
  } catch (error) {
    return responderOfertas(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = await leerCuerpo(request);
    const inicio = instante(cuerpo.inicio);
    const fin = instante(cuerpo.fin);
    rangoValido(inicio, fin);
    const productos = Array.isArray(cuerpo.productoIds) ? cuerpo.productoIds : [];
    const id = await guardarColeccion(slug, {
      id: cuerpo.id ? uuid(cuerpo.id) : null,
      nombre: parseNombreColeccion(cuerpo.nombre),
      descripcion: parseDescripcionColeccion(cuerpo.descripcion),
      inicio,
      fin,
      activa: cuerpo.activa !== false,
      productoIds: productos.map((producto) => uuid(producto)),
    });
    return jsonPrivado({ id });
  } catch (error) {
    return responderOfertas(error);
  }
}

async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    return datos as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NegocioError) throw error;
    throw new NegocioError("La solicitud no es válida.");
  }
}

function uuid(valor: unknown): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError("El producto no pertenece a la tienda.");
  return id;
}

function instante(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) return aTimestamptzBolivia(texto);
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) throw new NegocioError("Escribe la fecha y la hora.");
  return fecha.toISOString();
}
