import { listarInventario } from "@/lib/inventario/servicio";
import { jsonPrivado, responderInventario, sucursalDeConsulta } from "@/lib/inventario/http";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const inventario = await listarInventario(slug, sucursalDeConsulta(request.url));
    return jsonPrivado({
      sucursales: inventario.sucursales,
      filas: inventario.filas.map((fila) => ({
        productoId: fila.productoId,
        nombre: fila.nombre,
        categoria: fila.categoria,
        sucursalId: fila.sucursalId,
        sucursal: fila.sucursal,
        stock: fila.stock,
        stockMinimo: fila.stockMinimo,
        disponible: fila.disponible,
        activo: fila.activo,
        bajo: fila.stock <= fila.stockMinimo,
      })),
    });
  } catch (error) {
    return responderInventario(error);
  }
}
