import { NegocioError } from "@/lib/licencias/reglas";
import { jsonPrivado, responderInventario } from "@/lib/inventario/http";
import { ajustarStockAbsoluto, fijarMinimo, reponerStock } from "@/lib/inventario/servicio";
import { parseCantidad, parseMotivo } from "@/lib/inventario/reglas";
import { esUuid } from "@/lib/licencias/reglas";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = await leerCuerpo(request);
    const sucursalId = uuid(cuerpo.sucursalId);
    const productoId = uuid(cuerpo.productoId);
    if (cuerpo.accion === "minimo") {
      await fijarMinimo(slug, {
        sucursalId,
        productoId,
        minimo: parseCantidad(cuerpo.minimo, "el stock mínimo"),
      });
      return jsonPrivado({ ok: true });
    }
    if (cuerpo.accion === "ajuste") {
      const stock = await ajustarStockAbsoluto(slug, {
        sucursalId,
        productoId,
        stock: parseCantidad(cuerpo.stock, "el stock"),
        motivo: parseMotivo(cuerpo.motivo),
      });
      return jsonPrivado({ stock });
    }
    const cantidad = parseCantidad(cuerpo.cantidad, "la cantidad");
    if (cantidad <= 0) throw new NegocioError("La cantidad tiene que ser mayor que cero.");
    const stock = await reponerStock(slug, {
      sucursalId,
      productoId,
      cantidad,
      motivo: parseMotivo(cuerpo.motivo),
    });
    return jsonPrivado({ stock });
  } catch (error) {
    return responderInventario(error);
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
  if (!esUuid(id)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  return id;
}
