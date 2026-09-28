import { esUuid, NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderInventario } from "@/lib/inventario/http";
import { parseCantidad } from "@/lib/inventario/reglas";
import { transferirStock } from "@/lib/inventario/servicio";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.json();
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new NegocioError("La solicitud no es válida.");
    }
    const cuerpo = datos as Record<string, unknown>;
    const cantidad = parseCantidad(cuerpo.cantidad, "la cantidad");
    if (cantidad <= 0) throw new NegocioError("La cantidad tiene que ser mayor que cero.");
    await transferirStock(slug, {
      origenId: uuid(cuerpo.origenId),
      destinoId: uuid(cuerpo.destinoId),
      productoId: uuid(cuerpo.productoId),
      cantidad,
    });
    return jsonPrivado({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return responderInventario(new NegocioError("La solicitud no es válida."));
    }
    return responderInventario(error);
  }
}

function uuid(valor: unknown): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  return id;
}
