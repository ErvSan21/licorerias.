"use server";

import { revalidatePath } from "next/cache";

import {
  actualizarProducto,
  altaDesdeFormulario,
  archivoImagen,
  cambiarActivoProducto,
  configuracionDesdeFormulario,
  crearCategoria,
  crearProducto,
  eliminarProducto,
  guardarConfiguracionPrecios,
  leerProducto,
} from "@/lib/catalogo/servicio";
import { reponerStock } from "@/lib/inventario/servicio";
import { AccesoError, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { NegocioError } from "@/lib/licencias/reglas";

type Resultado = { ok: true; aviso: string; id?: string } | { ok: false; error: string };

export async function crearProductoAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const imagen = await archivoImagen(datos);
    const id = await crearProducto(slug, altaDesdeFormulario(datos), imagen);
    revalidar(slug, id);
    return { ok: true, aviso: "Producto creado.", id };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarProductoAccion(slug: string, productoId: string, datos: FormData): Promise<Resultado> {
  try {
    const imagen = await archivoImagen(datos);
    await actualizarProducto(slug, productoId, altaDesdeFormulario(datos), imagen);
    revalidar(slug, productoId);
    return { ok: true, aviso: "Producto guardado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

/** Alta rápida desde la hoja de Productos: se ofrece en las sucursales dadas y carga el stock inicial. */
export async function crearProductoRapidoAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const stock = Number(datos.get("stock") ?? 0);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
      throw new NegocioError("El stock tiene que ser un número entero desde 0.");
    }
    datos.set("activo", "on");
    const alta = altaDesdeFormulario(datos);
    const stockEn = datos.getAll("stockEn").map(String).filter((id) => alta.sucursalIds.includes(id));
    const imagen = await archivoImagen(datos);
    const id = await crearProducto(slug, alta, imagen);
    if (stock > 0) {
      for (const sucursalId of stockEn) {
        await reponerStock(slug, { productoId: id, sucursalId, cantidad: stock, motivo: "Stock inicial" });
      }
    }
    revalidar(slug, id);
    revalidatePath(`/t/${slug}/inventario`);
    revalidatePath(`/t/${slug}/ventas`);
    return { ok: true, aviso: "Producto creado.", id };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

/** Edición desde la hoja de Productos: nombre, categoría, precio e imagen. Lo demás se conserva. */
export async function editarProductoRapidoAccion(slug: string, productoId: string, datos: FormData): Promise<Resultado> {
  try {
    const { producto } = await leerProducto(slug, productoId);
    const actuales = producto.ofertas.filter((oferta) => oferta.disponible).map((oferta) => oferta.sucursalId);
    const alta = altaDesdeFormulario(datos);
    const imagen = await archivoImagen(datos);
    await actualizarProducto(
      slug,
      productoId,
      {
        ...alta,
        descripcion: producto.descripcion ?? "",
        sucursalIds: actuales,
        activo: producto.activo,
      },
      imagen,
    );
    revalidar(slug, productoId);
    revalidatePath(`/t/${slug}/ventas`);
    return { ok: true, aviso: "Producto guardado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function cambiarActivoProductoAccion(slug: string, productoId: string, activo: boolean): Promise<Resultado> {
  try {
    await cambiarActivoProducto(slug, productoId, activo);
    revalidar(slug, productoId);
    revalidatePath(`/t/${slug}/ventas`);
    return { ok: true, aviso: activo ? "Producto reactivado." : "Producto suspendido. Ya no aparece en Ventas." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function agregarStockAccion(
  slug: string,
  input: { productoId: string; sucursalId: string; cantidad: number },
): Promise<Resultado> {
  try {
    const cantidad = Number(input.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 100000) {
      throw new NegocioError("La cantidad tiene que ser mayor que cero.");
    }
    await reponerStock(slug, {
      productoId: input.productoId,
      sucursalId: input.sucursalId,
      cantidad,
      motivo: "Agregado desde Productos",
    });
    revalidar(slug, input.productoId);
    revalidatePath(`/t/${slug}/inventario`);
    revalidatePath(`/t/${slug}/ventas`);
    return { ok: true, aviso: `Se agregaron ${cantidad} unidades.` };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function eliminarProductoAccion(slug: string, productoId: string): Promise<Resultado> {
  try {
    await eliminarProducto(slug, productoId);
    revalidar(slug, productoId);
    return { ok: true, aviso: "Producto eliminado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarConfiguracionPreciosAccion(slug: string, datos: FormData): Promise<Resultado> {
  try {
    const config = configuracionDesdeFormulario(datos);
    await guardarConfiguracionPrecios(slug, config.permiten, config.margen);
    revalidar(slug);
    return {
      ok: true,
      aviso: config.permiten
        ? "Las sucursales pueden fijar su precio."
        : "Todas las sucursales usan el precio central.",
    };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function crearCategoriaAccion(slug: string, nombre: string): Promise<Resultado> {
  try {
    const id = await crearCategoria(slug, nombre);
    revalidar(slug);
    return { ok: true, aviso: "Categoría creada.", id };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

function revalidar(slug: string, productoId?: string) {
  revalidatePath(`/t/${slug}/productos`);
  if (productoId) {
    revalidatePath(`/t/${slug}/productos/${productoId}`);
    revalidatePath(`/t/${slug}/productos/${productoId}/historial`);
  }
}

function mensaje(error: unknown): string {
  if (error instanceof NegocioError) return error.message;
  if (error instanceof NoEncontrado) return "No encontrado.";
  if (error instanceof AccesoError) return mensajeAcceso(error.codigo);
  return "No se pudo completar. Inténtalo de nuevo.";
}
