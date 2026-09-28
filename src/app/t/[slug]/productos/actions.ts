"use server";

import { revalidatePath } from "next/cache";

import {
  actualizarProducto,
  ajustarPrecioCentralCategoria,
  ajustarPreciosPropios,
  altaDesdeFormulario,
  archivoImagen,
  configuracionDesdeFormulario,
  copiarPreciosPropios,
  crearCategoria,
  crearProducto,
  eliminarProducto,
  guardarConfiguracionPrecios,
  guardarPrecioCentral,
  guardarPrecioSucursal,
  volverPreciosCentrales,
} from "@/lib/catalogo/servicio";
import { parsePorcentaje, parsePrecio } from "@/lib/catalogo/reglas";
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

export async function eliminarProductoAccion(slug: string, productoId: string): Promise<Resultado> {
  try {
    await eliminarProducto(slug, productoId);
    revalidar(slug, productoId);
    return { ok: true, aviso: "Producto eliminado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarPrecioCentralAccion(
  slug: string,
  productoId: string,
  precio: string,
): Promise<Resultado> {
  try {
    await guardarPrecioCentral(slug, productoId, parsePrecio(precio));
    revalidar(slug, productoId);
    return { ok: true, aviso: "Precio central guardado." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function guardarPrecioSucursalAccion(
  slug: string,
  productoId: string,
  sucursalId: string,
  usaPrecioCentral: boolean,
  precio: string,
): Promise<Resultado> {
  try {
    await guardarPrecioSucursal(
      slug,
      productoId,
      sucursalId,
      usaPrecioCentral,
      usaPrecioCentral ? null : parsePrecio(precio),
    );
    revalidar(slug, productoId);
    return { ok: true, aviso: usaPrecioCentral ? "La sucursal volvió al precio central." : "Precio propio guardado." };
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

export async function volverPreciosCentralesAccion(slug: string, sucursalId: string): Promise<Resultado> {
  try {
    const total = await volverPreciosCentrales(slug, sucursalId);
    revalidar(slug);
    return { ok: true, aviso: total > 0 ? `Volvieron ${total} productos al precio central.` : "Ya estaban en precio central." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function ajustarCentralAccion(slug: string, categoriaId: string, porcentaje: string): Promise<Resultado> {
  try {
    const total = await ajustarPrecioCentralCategoria(slug, categoriaId, parsePorcentaje(porcentaje));
    revalidar(slug);
    return { ok: true, aviso: total > 0 ? `Se ajustó el precio central de ${total} productos.` : "Ningún precio cambió." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function ajustarPropiosAccion(slug: string, sucursalId: string, porcentaje: string): Promise<Resultado> {
  try {
    const total = await ajustarPreciosPropios(slug, sucursalId, parsePorcentaje(porcentaje));
    revalidar(slug);
    return { ok: true, aviso: total > 0 ? `Se ajustaron ${total} precios propios.` : "Ningún precio propio cambió." };
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
}

export async function copiarPreciosAccion(slug: string, origenId: string, destinoId: string): Promise<Resultado> {
  try {
    const total = await copiarPreciosPropios(slug, origenId, destinoId);
    revalidar(slug);
    return { ok: true, aviso: total > 0 ? `Se copiaron ${total} precios propios.` : "No había precios propios para copiar." };
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
  revalidatePath(`/t/${slug}/productos/precios`);
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
