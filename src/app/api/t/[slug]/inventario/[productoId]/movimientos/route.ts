import { jsonPrivado, responderInventario, sucursalDeConsulta } from "@/lib/inventario/http";
import { etiquetaMovimiento } from "@/lib/inventario/reglas";
import { leerMovimientos } from "@/lib/inventario/servicio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; productoId: string }> },
) {
  const { slug, productoId } = await params;
  try {
    const resultado = await leerMovimientos(slug, productoId, sucursalDeConsulta(request.url));
    return jsonPrivado({
      producto: resultado.producto.nombre,
      movimientos: resultado.movimientos.map((movimiento) => ({
        id: movimiento.id,
        sucursal: movimiento.sucursal,
        tipo: etiquetaMovimiento(movimiento.tipo),
        cantidad: movimiento.cantidad,
        motivo: movimiento.motivo,
        creadoEn: movimiento.creadoEn,
      })),
    });
  } catch (error) {
    return responderInventario(error);
  }
}
