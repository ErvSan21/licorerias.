import { redirect } from "next/navigation";

import { ProductosPanel, type ProductoTarjeta } from "@/components/panel/productos-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCatalogo } from "@/lib/catalogo/servicio";
import { listarInventario } from "@/lib/inventario/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function ProductosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/productos`)}`);
  }
  const [contexto, catalogo, inventario] = await Promise.all([
    contextoPanel(normalizado),
    listarCatalogo(normalizado),
    listarInventario(normalizado, null),
  ]);
  const rol = contexto.staff.rol;
  const dueno = rol === "dueno";
  const escribe = contexto.vigente;
  const visibles = new Set(contexto.sucursales.map((sucursal) => sucursal.id));
  const nombres = new Map(contexto.sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));
  const seleccion = contexto.seleccion;

  const productos: ProductoTarjeta[] = catalogo.productos.flatMap((producto) => {
    const ofertas = producto.ofertas.filter((oferta) => visibles.has(oferta.sucursalId));
    if (seleccion && !ofertas.some((oferta) => oferta.sucursalId === seleccion && (dueno || oferta.disponible))) {
      return [];
    }
    const filas = inventario.filas.filter(
      (fila) => fila.productoId === producto.id && (seleccion ? fila.sucursalId === seleccion : visibles.has(fila.sucursalId)),
    );
    const oferta = seleccion ? ofertas.find((item) => item.sucursalId === seleccion) : null;
    return [
      {
        id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria,
        categoriaId: producto.categoriaId,
        imagenUrl: producto.imagenUrl,
        precio: oferta?.precioEfectivo ?? producto.precioCentral,
        precioCentral: producto.precioCentral,
        stock: filas.reduce((suma, fila) => suma + fila.stock, 0),
        stockMinimo: filas.reduce((suma, fila) => suma + fila.stockMinimo, 0),
        activo: producto.activo,
        sucursales: ofertas.map((item) => ({
          id: item.sucursalId,
          nombre: nombres.get(item.sucursalId) ?? item.nombre,
          stock: inventario.filas.find((fila) => fila.productoId === producto.id && fila.sucursalId === item.sucursalId)?.stock ?? 0,
        })),
      },
    ];
  });

  const actual = seleccion ? { id: seleccion, nombre: nombres.get(seleccion) ?? "Sucursal" } : null;

  return (
    <ProductosPanel
      slug={contexto.tienda.slug}
      productos={productos.toSorted((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"))}
      categorias={catalogo.categorias.filter((categoria) => categoria.activa).map((categoria) => ({ id: categoria.id, nombre: categoria.nombre }))}
      sucursalesAlta={contexto.sucursales.filter((sucursal) => sucursal.activa).map((sucursal) => ({ id: sucursal.id, nombre: sucursal.nombre }))}
      sucursalActual={actual}
      permisos={{
        crear: dueno && escribe,
        stock: (dueno || rol === "gerente") && escribe,
        suspender: dueno && escribe,
        eliminar: dueno && escribe,
      }}
    />
  );
}
