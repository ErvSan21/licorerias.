import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff, type Staff } from "@/lib/auth/staff";
import { esUuid } from "@/lib/licencias/reglas";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { createServiceClient } from "@/lib/supabase/service";
import { ROLES_TIENDA, type RolTienda } from "@/lib/tenant";

import {
  NegocioError,
  parseDescripcion,
  parseIdsProducto,
  parseMargen,
  parseNombreCategoria,
  parseNombreProducto,
  parsePorcentaje,
  parsePrecio,
  precioEfectivo,
} from "./reglas";
import type { AltaProducto, ArchivoImagen, CategoriaLista, HistorialItem, ProductoLista, SucursalCatalogo } from "./tipos";

export type Catalogo = {
  staff: Staff;
  slug: string;
  permitenPrecioPropio: boolean;
  margenMax: number | null;
  categorias: CategoriaLista[];
  productos: ProductoLista[];
  sucursales: SucursalCatalogo[];
};

export type { AltaProducto, ArchivoImagen, CategoriaLista, HistorialItem, OfertaSucursal, ProductoLista, SucursalCatalogo } from "./tipos";

const MAX_IMAGEN = 1_500_000;

type FilaProducto = {
  id: string;
  tienda_id: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  imagen_url: string | null;
  precio_central: number | string;
  activo: boolean;
};

type FilaOferta = {
  producto_id: string;
  sucursal_id: string;
  usa_precio_central: boolean;
  precio_propio: number | string | null;
  disponible: boolean;
};

type FilaCategoria = {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
};

type FilaSucursal = {
  id: string;
  nombre: string;
};

export function altaDesdeFormulario(datos: FormData): AltaProducto {
  const categoria = String(datos.get("categoriaId") ?? "");
  return {
    nombre: parseNombreProducto(datos.get("nombre")),
    descripcion: parseDescripcion(datos.get("descripcion")),
    categoriaId: categoria && esUuid(categoria) ? categoria : null,
    nuevaCategoria: String(datos.get("nuevaCategoria") ?? "").trim(),
    precioCentral: parsePrecio(datos.get("precioCentral")),
    sucursalIds: parseIdsProducto(datos.getAll("sucursal")),
    activo: datos.getAll("activo").includes("on"),
  };
}

export async function archivoImagen(datos: FormData): Promise<ArchivoImagen | null> {
  const archivo = datos.get("imagen");
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (archivo.size > MAX_IMAGEN) {
    throw new NegocioError("La imagen tiene que pesar menos de 1,5 MB. Se comprime a 800 px antes de subir.");
  }
  if (archivo.type !== "image/jpeg" && archivo.type !== "image/png" && archivo.type !== "image/webp") {
    throw new NegocioError("La imagen tiene que ser JPG, PNG o WebP.");
  }
  return {
    bytes: new Uint8Array(await archivo.arrayBuffer()),
    tipo: archivo.type,
  };
}

export async function listarCatalogo(slug: string): Promise<Catalogo> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ROLES_TIENDA);
  const service = createServiceClient();
  const [productosRes, categoriasRes, ofertasRes, sucursalesRes, configRes, asignadas] = await Promise.all([
    service
      .from("productos")
      .select("id, tienda_id, nombre, descripcion, categoria_id, imagen_url, precio_central, activo")
      .eq("tienda_id", tienda.id)
      .order("nombre"),
    service
      .from("categorias")
      .select("id, nombre, orden, activa")
      .eq("tienda_id", tienda.id)
      .order("orden"),
    service
      .from("producto_sucursal")
      .select("producto_id, sucursal_id, usa_precio_central, precio_propio, disponible")
      .eq("tienda_id", tienda.id),
    service.from("sucursales").select("id, nombre").eq("tienda_id", tienda.id).order("orden").order("nombre"),
    service
      .from("configuracion_tienda")
      .select("sucursales_pueden_fijar_precio, margen_max_porcentaje")
      .eq("tienda_id", tienda.id)
      .maybeSingle(),
    staff.rol === "dueno"
      ? Promise.resolve(null)
      : service.from("miembro_sucursales").select("sucursal_id").eq("miembro_id", staff.miembroId),
  ]);

  if (productosRes.error) throw new Error(productosRes.error.message);
  if (categoriasRes.error) throw new Error(categoriasRes.error.message);
  if (ofertasRes.error) throw new Error(ofertasRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);
  if (configRes.error) throw new Error(configRes.error.message);
  if (asignadas && asignadas.error) throw new Error(asignadas.error.message);

  const permitidas = new Set(
    staff.rol === "dueno"
      ? ((sucursalesRes.data ?? []) as FilaSucursal[]).map((fila) => fila.id)
      : ((asignadas?.data ?? []) as { sucursal_id: string }[]).map((fila) => fila.sucursal_id),
  );
  const sucursales = ((sucursalesRes.data ?? []) as FilaSucursal[])
    .filter((fila) => permitidas.has(fila.id))
    .map((fila) => ({ id: fila.id, nombre: fila.nombre }));
  const nombres = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));
  const config = configRes.data as
    | { sucursales_pueden_fijar_precio: boolean; margen_max_porcentaje: number | string | null }
    | null;
  const permitenPrecioPropio = config?.sucursales_pueden_fijar_precio ?? true;
  const margenMax = config?.margen_max_porcentaje == null ? null : numero(config.margen_max_porcentaje);
  const categorias = (categoriasRes.data ?? []) as FilaCategoria[];
  const nombreCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]));
  const ofertas = ((ofertasRes.data ?? []) as FilaOferta[]).filter((fila) => permitidas.has(fila.sucursal_id));
  const porProducto = new Map<string, FilaOferta[]>();
  for (const oferta of ofertas) {
    const lista = porProducto.get(oferta.producto_id) ?? [];
    lista.push(oferta);
    porProducto.set(oferta.producto_id, lista);
  }

  const productos = ((productosRes.data ?? []) as FilaProducto[]).flatMap((fila) => {
    const propias = porProducto.get(fila.id) ?? [];
    if (staff.rol !== "dueno" && !propias.some((oferta) => oferta.disponible)) return [];
    if (staff.rol !== "dueno" && !fila.activo) return [];
    const precioCentral = numero(fila.precio_central);
    return [
      {
        id: fila.id,
        nombre: fila.nombre,
        descripcion: fila.descripcion,
        categoriaId: fila.categoria_id,
        categoria: fila.categoria_id ? (nombreCategoria.get(fila.categoria_id) ?? null) : null,
        imagenUrl: fila.imagen_url,
        precioCentral,
        activo: fila.activo,
        ofertas: propias.map((oferta) => ({
          sucursalId: oferta.sucursal_id,
          nombre: nombres.get(oferta.sucursal_id) ?? "Sucursal",
          disponible: oferta.disponible,
          usaPrecioCentral: oferta.usa_precio_central,
          precioPropio: oferta.precio_propio == null ? null : numero(oferta.precio_propio),
          precioEfectivo: precioEfectivo({
            activo: fila.activo,
            disponible: oferta.disponible,
            usaPrecioCentral: oferta.usa_precio_central,
            precioCentral,
            precioPropio: oferta.precio_propio == null ? null : numero(oferta.precio_propio),
            permitenPrecioPropio,
          }),
        })),
      },
    ];
  });

  return {
    staff,
    slug: tienda.slug,
    permitenPrecioPropio,
    margenMax,
    categorias: categorias.map((categoria) => ({
      id: categoria.id,
      nombre: categoria.nombre,
      orden: categoria.orden,
      activa: categoria.activa,
    })),
    productos,
    sucursales,
  };
}

export async function leerProducto(slug: string, productoId: string): Promise<{
  catalogo: Catalogo;
  producto: ProductoLista;
}> {
  if (!esUuid(productoId)) throw new NoEncontrado();
  const catalogo = await listarCatalogo(slug);
  const producto = catalogo.productos.find((item) => item.id === productoId);
  if (!producto) throw new NoEncontrado();
  return { catalogo, producto };
}

export async function crearProducto(slug: string, input: AltaProducto, imagen: ArchivoImagen | null): Promise<string> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  const categoriaId = await resolverCategoria(tienda.id, input);
  const service = createServiceClient();
  const { data, error } = await service.rpc("crear_producto", {
    p_tienda: tienda.id,
    p_nombre: input.nombre,
    p_descripcion: input.descripcion,
    p_categoria: categoriaId,
    p_precio: input.precioCentral,
    p_sucursales: input.sucursalIds,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  if (typeof data !== "string") throw new Error("No se creó el producto.");

  try {
    if (imagen) await guardarImagen(tienda.id, data, imagen);
  } catch (causa) {
    await service.from("productos").delete().eq("id", data).eq("tienda_id", tienda.id);
    throw causa;
  }

  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "producto.alta",
    detalle: { producto_id: data, sucursales: input.sucursalIds.length },
  });
  return data;
}

export async function actualizarProducto(
  slug: string,
  productoId: string,
  input: AltaProducto,
  imagen: ArchivoImagen | null,
): Promise<void> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(productoId)) throw new NoEncontrado();
  const actual = await productoDeTienda(tienda.id, productoId);
  const categoriaId = await resolverCategoria(tienda.id, input);
  const service = createServiceClient();
  const { error } = await service
    .from("productos")
    .update({
      nombre: input.nombre,
      descripcion: input.descripcion || null,
      categoria_id: categoriaId,
      activo: input.activo,
    })
    .eq("id", productoId)
    .eq("tienda_id", tienda.id);
  if (error) lanzarPrecio(error.message);

  if (input.precioCentral !== numero(actual.precio_central)) {
    const cambio = await service.rpc("guardar_precio_central", {
      p_tienda: tienda.id,
      p_producto: productoId,
      p_precio: input.precioCentral,
      p_user: staff.userId,
    });
    if (cambio.error) lanzarPrecio(cambio.error.message);
  }

  const sucursales = await service.rpc("fijar_sucursales_producto", {
    p_tienda: tienda.id,
    p_producto: productoId,
    p_sucursales: input.sucursalIds,
  });
  if (sucursales.error) lanzarPrecio(sucursales.error.message);
  if (imagen) await guardarImagen(tienda.id, productoId, imagen);

  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "producto.editar",
    detalle: { producto_id: productoId },
  });
}

export async function eliminarProducto(slug: string, productoId: string): Promise<void> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(productoId)) throw new NoEncontrado();
  const actual = await productoDeTienda(tienda.id, productoId);
  const service = createServiceClient();
  const { error } = await service.from("productos").delete().eq("id", productoId).eq("tienda_id", tienda.id);
  if (error) lanzarPrecio(error.message);
  await borrarImagen(tienda.id, actual.imagen_url);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "producto.eliminar",
    detalle: { producto_id: productoId },
  });
}

export async function guardarPrecioCentral(slug: string, productoId: string, precio: number): Promise<void> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(productoId)) throw new NoEncontrado();
  const limpio = parsePrecio(precio);
  const service = createServiceClient();
  const { error } = await service.rpc("guardar_precio_central", {
    p_tienda: tienda.id,
    p_producto: productoId,
    p_precio: limpio,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.central",
    detalle: { producto_id: productoId, precio: limpio },
  });
}

export async function guardarPrecioSucursal(
  slug: string,
  productoId: string,
  sucursalId: string,
  usaPrecioCentral: boolean,
  precio: number | null,
): Promise<void> {
  const { tienda, staff } = await exigirCatalogo(slug, sucursalId, ["dueno", "gerente"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(productoId)) throw new NoEncontrado();
  const propio = usaPrecioCentral ? null : parsePrecio(precio);
  const service = createServiceClient();
  const { error } = await service.rpc("guardar_precio_sucursal", {
    p_tienda: tienda.id,
    p_producto: productoId,
    p_sucursal: sucursalId,
    p_usa_central: usaPrecioCentral,
    p_precio: propio,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: usaPrecioCentral ? "precio.volver_central" : "precio.propio",
    detalle: { producto_id: productoId, sucursal_id: sucursalId, precio: propio },
  });
}

export async function guardarConfiguracionPrecios(
  slug: string,
  permiten: boolean,
  margen: number | null,
): Promise<void> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  const service = createServiceClient();
  const { error } = await service.rpc("guardar_configuracion_precios", {
    p_tienda: tienda.id,
    p_permite: permiten,
    p_margen: margen,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.configuracion",
    detalle: { permiten, margen },
  });
}

export async function volverPreciosCentrales(slug: string, sucursalId: string): Promise<number> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  const service = createServiceClient();
  const { data, error } = await service.rpc("volver_precios_centrales", {
    p_tienda: tienda.id,
    p_sucursal: sucursalId,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  const total = Number(data ?? 0);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.volver_todos",
    detalle: { sucursal_id: sucursalId, total },
  });
  return total;
}

export async function ajustarPrecioCentralCategoria(
  slug: string,
  categoriaId: string,
  porcentaje: number,
): Promise<number> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(categoriaId)) throw new NegocioError("La categoría no pertenece a la tienda.");
  const limpio = parsePorcentaje(porcentaje);
  const service = createServiceClient();
  const { data, error } = await service.rpc("ajustar_precio_central_categoria", {
    p_tienda: tienda.id,
    p_categoria: categoriaId,
    p_porcentaje: limpio,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  const total = Number(data ?? 0);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.ajuste_central",
    detalle: { categoria_id: categoriaId, porcentaje: limpio, total },
  });
  return total;
}

export async function ajustarPreciosPropios(slug: string, sucursalId: string, porcentaje: number): Promise<number> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  const limpio = parsePorcentaje(porcentaje);
  const service = createServiceClient();
  const { data, error } = await service.rpc("ajustar_precios_propios", {
    p_tienda: tienda.id,
    p_sucursal: sucursalId,
    p_porcentaje: limpio,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  const total = Number(data ?? 0);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.ajuste_propio",
    detalle: { sucursal_id: sucursalId, porcentaje: limpio, total },
  });
  return total;
}

export async function copiarPreciosPropios(slug: string, origenId: string, destinoId: string): Promise<number> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(origenId) || !esUuid(destinoId)) {
    throw new NegocioError("La sucursal no pertenece a la tienda.");
  }
  const service = createServiceClient();
  const { data, error } = await service.rpc("copiar_precios_propios", {
    p_tienda: tienda.id,
    p_origen: origenId,
    p_destino: destinoId,
    p_user: staff.userId,
  });
  if (error) lanzarPrecio(error.message);
  const total = Number(data ?? 0);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "precio.copiar",
    detalle: { origen_id: origenId, destino_id: destinoId, total },
  });
  return total;
}

export async function listarHistorial(slug: string, productoId: string): Promise<{
  producto: ProductoLista;
  historial: HistorialItem[];
}> {
  const { catalogo, producto } = await leerProducto(slug, productoId);
  const service = createServiceClient();
  const { data, error } = await service
    .from("historial_precios")
    .select("id, tipo, sucursal_id, precio_anterior, precio_nuevo, creado_en")
    .eq("producto_id", productoId)
    .eq("tienda_id", catalogo.staff.tiendaId)
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const permitidas = new Set(catalogo.sucursales.map((sucursal) => sucursal.id));
  const nombres = new Map(catalogo.sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));
  const historial = ((data ?? []) as {
    id: string;
    tipo: string;
    sucursal_id: string | null;
    precio_anterior: number | string | null;
    precio_nuevo: number | string;
    creado_en: string;
  }[]).flatMap((fila): HistorialItem[] => {
    if (catalogo.staff.rol !== "dueno" && fila.sucursal_id && !permitidas.has(fila.sucursal_id)) return [];
    const tipo = fila.tipo === "central" || fila.tipo === "propio" ? fila.tipo : null;
    if (!tipo) return [];
    return [
      {
        id: fila.id,
        tipo,
        sucursalId: fila.sucursal_id,
        sucursalNombre: fila.sucursal_id ? (nombres.get(fila.sucursal_id) ?? null) : null,
        precioAnterior: fila.precio_anterior == null ? null : numero(fila.precio_anterior),
        precioNuevo: numero(fila.precio_nuevo),
        creadoEn: fila.creado_en,
      },
    ];
  });
  return { producto, historial };
}

export async function crearCategoria(slug: string, nombre: string): Promise<string> {
  const { tienda, staff } = await exigirCatalogo(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(tienda.id);
  const limpio = parseNombreCategoria(nombre);
  const service = createServiceClient();
  const { data: ordenFila } = await service
    .from("categorias")
    .select("orden")
    .eq("tienda_id", tienda.id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((ordenFila as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await service
    .from("categorias")
    .insert({ tienda_id: tienda.id, nombre: limpio, orden, activa: true })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new NegocioError("Ya existe una categoría con ese nombre.");
    throw new Error(error.message);
  }
  const id = (data as { id: string }).id;
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "categoria.alta",
    detalle: { categoria_id: id },
  });
  return id;
}

export function configuracionDesdeFormulario(datos: FormData): { permiten: boolean; margen: number | null } {
  return {
    permiten: datos.get("permiten") === "on",
    margen: parseMargen(datos.get("margen")),
  };
}

async function exigirCatalogo(slug: string, sucursalId: string | null, roles: readonly RolTienda[]) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId, roles });
  return { tienda, staff };
}

async function productoDeTienda(tiendaId: string, productoId: string): Promise<FilaProducto> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("productos")
    .select("id, tienda_id, nombre, descripcion, categoria_id, imagen_url, precio_central, activo")
    .eq("id", productoId)
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as FilaProducto | null;
  if (!fila || fila.tienda_id !== tiendaId) throw new NoEncontrado();
  return fila;
}

async function resolverCategoria(tiendaId: string, input: AltaProducto): Promise<string | null> {
  if (input.nuevaCategoria) {
    const nombre = parseNombreCategoria(input.nuevaCategoria);
    const service = createServiceClient();
    const { data: existente } = await service
      .from("categorias")
      .select("id, nombre")
      .eq("tienda_id", tiendaId);
    const previa = ((existente ?? []) as { id: string; nombre: string }[]).find(
      (categoria) => categoria.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (previa) return previa.id;
    const { data: ordenFila } = await service
      .from("categorias")
      .select("orden")
      .eq("tienda_id", tiendaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((ordenFila as { orden: number } | null)?.orden ?? 0) + 1;
    const { data, error } = await service
      .from("categorias")
      .insert({ tienda_id: tiendaId, nombre, orden, activa: true })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new NegocioError("Ya existe una categoría con ese nombre.");
      throw new Error(error.message);
    }
    return (data as { id: string }).id;
  }
  if (!input.categoriaId) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("categorias")
    .select("id")
    .eq("id", input.categoriaId)
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new NegocioError("La categoría no pertenece a la tienda.");
  return input.categoriaId;
}

async function guardarImagen(tiendaId: string, productoId: string, imagen: ArchivoImagen): Promise<void> {
  const extension = imagen.tipo === "image/png" ? "png" : imagen.tipo === "image/webp" ? "webp" : "jpg";
  const ruta = `${tiendaId}/productos/${productoId}.${extension}`;
  const service = createServiceClient();
  const { error } = await service.storage.from("productos").upload(ruta, imagen.bytes, {
    contentType: imagen.tipo,
    upsert: true,
  });
  if (error) throw new NegocioError("No se pudo guardar la imagen.");
  const publica = service.storage.from("productos").getPublicUrl(ruta);
  const { error: actualizacion } = await service
    .from("productos")
    .update({ imagen_url: publica.data.publicUrl })
    .eq("id", productoId)
    .eq("tienda_id", tiendaId);
  if (actualizacion) throw new Error(actualizacion.message);
}

async function borrarImagen(tiendaId: string, url: string | null): Promise<void> {
  if (!url) return;
  const marca = "/storage/v1/object/public/productos/";
  const indice = url.indexOf(marca);
  if (indice < 0) return;
  const ruta = decodeURIComponent(url.slice(indice + marca.length));
  if (!ruta.startsWith(`${tiendaId}/productos/`)) return;
  const service = createServiceClient();
  await service.storage.from("productos").remove([ruta]);
}

function numero(valor: number | string): number {
  const convertido = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(convertido)) throw new Error("Precio inválido.");
  return convertido;
}

function lanzarPrecio(mensaje: string): never {
  const conocidos = [
    "Has alcanzado el máximo de productos de tu plan",
    "El precio central no puede ser negativo.",
    "Escribe el nombre del producto.",
    "La sucursal no pertenece a la tienda.",
    "La categoría no pertenece a la tienda.",
    "El producto no pertenece a la tienda.",
    "El precio propio es obligatorio.",
    "Esta tienda no permite precios propios.",
    "El precio propio supera el margen máximo.",
    "Hay precios propios por encima del margen máximo.",
    "Hay precios propios que superarían el margen máximo.",
    "El ajuste dejaría un precio negativo.",
    "El porcentaje tiene que estar entre -100 y 1000.",
    "El margen máximo no puede ser negativo.",
    "Elige otra sucursal de destino.",
    "Producto no encontrado.",
    "El producto no se ofrece en esa sucursal.",
    "La tienda no tiene licencia.",
  ];
  for (const texto of conocidos) {
    if (mensaje.includes(texto)) {
      if (texto === "Producto no encontrado.") throw new NoEncontrado();
      throw new NegocioError(texto);
    }
  }
  const cupo = mensaje.match(/Has alcanzado el máximo de .+ de tu plan/);
  if (cupo) throw new NegocioError(cupo[0]);
  throw new Error(mensaje);
}
