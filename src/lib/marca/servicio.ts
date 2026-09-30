import "server-only";

import { cache } from "react";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { NegocioError } from "@/lib/licencias/reglas";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { createServiceClient } from "@/lib/supabase/service";

import {
  marcaDesdeJson,
  marcaVacia,
  parseBienvenida,
  parseColorMarca,
  parseNombreComercial,
  type MarcaPublica,
} from "./reglas";

export type { MarcaPublica } from "./reglas";

const MAX_IMAGEN = 1_500_000;

type Pieza = "logo" | "banner" | "qr";

type Archivo = { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" | "image/webp" };

type Fila = {
  nombre_comercial: string | null;
  logo_url: string | null;
  color_primario: string | null;
  banner_url: string | null;
  mensaje_bienvenida: string | null;
};

export const leerMarcaPublica = cache(async (slug: string): Promise<MarcaPublica> => {
  const service = createServiceClient();
  const { data, error } = await service.rpc("marca_publica", { p_slug: slug });
  if (error) throw new Error(error.message);
  return marcaDesdeJson(data);
});

export async function leerMarcaDueno(slug: string): Promise<MarcaPublica> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  return leerFila(tienda.id);
}

export async function guardarMarca(
  slug: string,
  input: {
    nombreComercial: unknown;
    colorPrimario: unknown;
    mensajeBienvenida: unknown;
    quitarLogo: boolean;
    quitarBanner: boolean;
  },
  archivos: { logo: Archivo | null; banner: Archivo | null },
): Promise<MarcaPublica> {
  const nombreComercial = parseNombreComercial(input.nombreComercial);
  const colorPrimario = parseColorMarca(input.colorPrimario);
  const mensajeBienvenida = parseBienvenida(input.mensajeBienvenida);
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  await exigirLicenciaParaEscribir(tienda.id);
  const actual = await leerFila(tienda.id);
  let logoUrl = input.quitarLogo ? null : actual.logoUrl;
  let bannerUrl = input.quitarBanner ? null : actual.bannerUrl;
  if (archivos.logo) logoUrl = await subir(tienda.id, "logo", archivos.logo);
  if (archivos.banner) bannerUrl = await subir(tienda.id, "banner", archivos.banner);
  if (input.quitarLogo && !archivos.logo) await borrar(tienda.id, "logo");
  if (input.quitarBanner && !archivos.banner) await borrar(tienda.id, "banner");
  const service = createServiceClient();
  const { error } = await service
    .from("configuracion_tienda")
    .update({
      nombre_comercial: nombreComercial,
      color_primario: colorPrimario,
      mensaje_bienvenida: mensajeBienvenida,
      logo_url: logoUrl,
      banner_url: bannerUrl,
    })
    .eq("tienda_id", tienda.id);
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "marca.guardar",
    detalle: {
      nombre_comercial: nombreComercial,
      color_primario: colorPrimario,
      logo: Boolean(logoUrl),
      banner: Boolean(bannerUrl),
    },
  });
  return { nombreComercial, logoUrl, colorPrimario, bannerUrl, mensajeBienvenida };
}

/** QR de cobro que el cliente ve al elegir "QR". Solo el dueño lo ve y lo cambia. */
export async function leerQrPagoDueno(slug: string): Promise<string | null> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  return leerQrPago(tienda.id);
}

/** QR de cobro para la tienda pública. Sin la migración aplicada, no hay QR. */
export async function leerQrPago(tiendaId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("configuracion_tienda")
    .select("qr_pago_url")
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) return null;
  return (data as { qr_pago_url: string | null } | null)?.qr_pago_url ?? null;
}

export async function guardarQrPago(slug: string, archivo: Archivo | null, quitar: boolean): Promise<string | null> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  await exigirLicenciaParaEscribir(tienda.id);
  if (!archivo && !quitar) throw new NegocioError("Elige la imagen del QR.");
  const url = archivo ? await subir(tienda.id, "qr", archivo) : null;
  if (!archivo) await borrar(tienda.id, "qr");
  const service = createServiceClient();
  const { error } = await service.from("configuracion_tienda").update({ qr_pago_url: url }).eq("tienda_id", tienda.id);
  if (error) {
    if (/qr_pago_url/.test(error.message)) {
      throw new NegocioError("Falta aplicar la migración de pagos en la base de datos (supabase/pendientes.sql).");
    }
    throw new Error(error.message);
  }
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: url ? "pagos.qr_guardar" : "pagos.qr_quitar",
    detalle: {},
  });
  return url;
}

export async function archivoMarca(datos: FormData, campo: Pieza): Promise<Archivo | null> {
  const archivo = datos.get(campo);
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (archivo.size > MAX_IMAGEN) {
    throw new NegocioError("La imagen tiene que pesar menos de 1,5 MB. Se comprime a 800 px antes de subir.");
  }
  if (archivo.type !== "image/jpeg" && archivo.type !== "image/png" && archivo.type !== "image/webp") {
    throw new NegocioError("La imagen tiene que ser JPG, PNG o WebP.");
  }
  return { bytes: new Uint8Array(await archivo.arrayBuffer()), tipo: archivo.type };
}

async function leerFila(tiendaId: string): Promise<MarcaPublica> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("configuracion_tienda")
    .select("nombre_comercial, logo_url, color_primario, banner_url, mensaje_bienvenida")
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as Fila | null;
  if (!fila) return marcaVacia;
  return {
    nombreComercial: fila.nombre_comercial,
    logoUrl: fila.logo_url,
    colorPrimario: fila.color_primario,
    bannerUrl: fila.banner_url,
    mensajeBienvenida: fila.mensaje_bienvenida,
  };
}

async function subir(tiendaId: string, pieza: Pieza, imagen: Archivo): Promise<string> {
  const extension = imagen.tipo === "image/png" ? "png" : imagen.tipo === "image/webp" ? "webp" : "jpg";
  const ruta = `${tiendaId}/marca/${pieza}.${extension}`;
  const service = createServiceClient();
  const { error } = await service.storage.from("marca").upload(ruta, imagen.bytes, {
    contentType: imagen.tipo,
    upsert: true,
  });
  if (error) throw new NegocioError("No se pudo guardar la imagen.");
  await borrarOtras(tiendaId, pieza, extension);
  const publica = service.storage.from("marca").getPublicUrl(ruta);
  return `${publica.data.publicUrl}?v=${Date.now()}`;
}

async function borrar(tiendaId: string, pieza: Pieza): Promise<void> {
  await borrarOtras(tiendaId, pieza, null);
}

async function borrarOtras(tiendaId: string, pieza: Pieza, conservar: string | null): Promise<void> {
  const rutas = ["jpg", "png", "webp"]
    .filter((extension) => extension !== conservar)
    .map((extension) => `${tiendaId}/marca/${pieza}.${extension}`);
  if (rutas.length === 0) return;
  const service = createServiceClient();
  await service.storage.from("marca").remove(rutas);
}
