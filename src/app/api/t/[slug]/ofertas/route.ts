import { NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderOfertas } from "@/lib/ofertas/http";
import { aTimestamptzBolivia, parseTipoOferta, parseValorOferta, rangoValido } from "@/lib/ofertas/reglas";
import { guardarOferta, listarOfertas } from "@/lib/ofertas/servicio";
import { esUuid } from "@/lib/licencias/reglas";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const lista = await listarOfertas(slug);
    return jsonPrivado(lista);
  } catch (error) {
    return responderOfertas(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = await leerCuerpo(request);
    const tipo = parseTipoOferta(cuerpo.tipo);
    const inicio = instante(cuerpo.inicio);
    const fin = instante(cuerpo.fin);
    rangoValido(inicio, fin);
    const id = await guardarOferta(slug, {
      id: cuerpo.id ? uuid(cuerpo.id, "Oferta no encontrada.") : null,
      productoId: uuid(cuerpo.productoId, "El producto no pertenece a la tienda."),
      sucursalId: cuerpo.sucursalId ? uuid(cuerpo.sucursalId, "La sucursal no pertenece a la tienda.") : null,
      tipo,
      valor: parseValorOferta(tipo, cuerpo.valor),
      inicio,
      fin,
      activa: cuerpo.activa !== false,
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

function uuid(valor: unknown, mensaje: string): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError(mensaje);
  return id;
}

function instante(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) return aTimestamptzBolivia(texto);
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) throw new NegocioError("Escribe la fecha y la hora.");
  return fecha.toISOString();
}
