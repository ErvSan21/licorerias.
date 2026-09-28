import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { esUuid } from "@/lib/licencias/reglas";
import { createServiceClient } from "@/lib/supabase/service";
import { ROLES_TIENDA, type RolTienda } from "@/lib/tenant";

import {
  distanciaCalleOHaversine,
  NegocioError,
  parseCostoEnvio,
  parseCoordenadaCliente,
  parseHastaKm,
  parseNombreZona,
  parseRadioKm,
  parseTipoZona,
  resolverZona,
  elegirTarifa,
  type Punto,
} from "./reglas";

const ESCRITURA = ["dueno", "gerente"] as const;

export type TarifaLista = {
  id: string;
  sucursalId: string;
  sucursal: string;
  hastaKm: number;
  costo: number;
};

export type ZonaLista = {
  id: string;
  sucursalId: string;
  sucursal: string;
  nombre: string;
  lat: number;
  lng: number;
  radioKm: number;
  tipo: "tarifa_fija" | "bloqueada";
  costo: number | null;
  activa: boolean;
};

export type ResultadoEnvio =
  | { disponible: false; motivo: "fuera_de_zona" | "sin_ubicacion" }
  | { disponible: true; costo: number; distanciaKm: number; origen: "zona" | "tarifa"; metodo: "calle" | "haversine" };

export async function listarEnvio(slug: string): Promise<{
  tarifas: TarifaLista[];
  zonas: ZonaLista[];
  sucursales: { id: string; nombre: string; lat: number | null; lng: number | null }[];
}> {
  const { tienda, staff } = await exigir(slug, null, ROLES_TIENDA);
  const permitidas = await sucursalesPermitidas(staff.miembroId, staff.rol, tienda.id);
  const service = createServiceClient();
  const [tarifasRes, zonasRes, sucursalesRes] = await Promise.all([
    service
      .from("tarifas_envio")
      .select("id, tienda_id, sucursal_id, hasta_km, costo")
      .eq("tienda_id", tienda.id)
      .order("hasta_km"),
    service
      .from("zonas_reparto")
      .select("id, tienda_id, sucursal_id, nombre, lat_centro, lng_centro, radio_km, tipo, costo, activa")
      .eq("tienda_id", tienda.id)
      .order("nombre"),
    service.from("sucursales").select("id, nombre, lat, lng").eq("tienda_id", tienda.id).order("nombre"),
  ]);
  if (tarifasRes.error) throw new Error(tarifasRes.error.message);
  if (zonasRes.error) throw new Error(zonasRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);

  const sucursales = ((sucursalesRes.data ?? []) as { id: string; nombre: string; lat: number | null; lng: number | null }[])
    .filter((fila) => permitidas.has(fila.id));
  const nombres = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal.nombre]));

  const tarifas = ((tarifasRes.data ?? []) as FilaTarifa[]).flatMap((fila) => {
    if (fila.tienda_id !== tienda.id || !permitidas.has(fila.sucursal_id)) return [];
    return [
      {
        id: fila.id,
        sucursalId: fila.sucursal_id,
        sucursal: nombres.get(fila.sucursal_id) ?? "Sucursal",
        hastaKm: Number(fila.hasta_km),
        costo: Number(fila.costo),
      },
    ];
  });

  const zonas = ((zonasRes.data ?? []) as FilaZona[]).flatMap((fila) => {
    if (fila.tienda_id !== tienda.id || !permitidas.has(fila.sucursal_id)) return [];
    const tipo = fila.tipo === "bloqueada" ? "bloqueada" : "tarifa_fija";
    return [
      {
        id: fila.id,
        sucursalId: fila.sucursal_id,
        sucursal: nombres.get(fila.sucursal_id) ?? "Sucursal",
        nombre: fila.nombre,
        lat: fila.lat_centro,
        lng: fila.lng_centro,
        radioKm: Number(fila.radio_km),
        tipo,
        costo: fila.costo == null ? null : Number(fila.costo),
        activa: fila.activa,
      } satisfies ZonaLista,
    ];
  });

  return { tarifas, zonas, sucursales };
}

export async function guardarTarifa(
  slug: string,
  input: { id: string | null; sucursalId: string; hastaKm: number; costo: number },
): Promise<string> {
  const { tienda, staff } = await exigir(slug, input.sucursalId, ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  const service = createServiceClient();
  const { data, error } = await service.rpc("guardar_tarifa", {
    p_tienda: tienda.id,
    p_tarifa: input.id,
    p_sucursal: input.sucursalId,
    p_hasta_km: input.hastaKm,
    p_costo: input.costo,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  if (typeof data !== "string") throw new Error("No se guardó la tarifa.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: input.id ? "envio.tarifa.edicion" : "envio.tarifa.alta",
    detalle: { tarifa_id: data, sucursal_id: input.sucursalId, hasta_km: input.hastaKm },
  });
  return data;
}

export async function eliminarTarifa(slug: string, id: string, sucursalId: string): Promise<void> {
  const { tienda, staff } = await exigir(slug, sucursalId, ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(id)) throw new NoEncontrado();
  const service = createServiceClient();
  const { error } = await service.rpc("eliminar_tarifa", {
    p_tienda: tienda.id,
    p_tarifa: id,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "envio.tarifa.baja",
    detalle: { tarifa_id: id },
  });
}

export async function guardarZona(
  slug: string,
  input: {
    id: string | null;
    sucursalId: string;
    nombre: string;
    lat: number;
    lng: number;
    radioKm: number;
    tipo: "tarifa_fija" | "bloqueada";
    costo: number | null;
    activa: boolean;
  },
): Promise<string> {
  const { tienda, staff } = await exigir(slug, input.sucursalId, ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  const service = createServiceClient();
  const { data, error } = await service.rpc("guardar_zona", {
    p_tienda: tienda.id,
    p_zona: input.id,
    p_sucursal: input.sucursalId,
    p_nombre: input.nombre,
    p_lat: input.lat,
    p_lng: input.lng,
    p_radio: input.radioKm,
    p_tipo: input.tipo,
    p_costo: input.tipo === "bloqueada" ? null : input.costo,
    p_activa: input.activa,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  if (typeof data !== "string") throw new Error("No se guardó la zona.");
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: input.id ? "envio.zona.edicion" : "envio.zona.alta",
    detalle: { zona_id: data, sucursal_id: input.sucursalId, tipo: input.tipo },
  });
  return data;
}

export async function eliminarZona(slug: string, id: string, sucursalId: string): Promise<void> {
  const { tienda, staff } = await exigir(slug, sucursalId, ESCRITURA);
  await exigirLicenciaParaEscribir(tienda.id);
  if (!esUuid(id)) throw new NoEncontrado();
  const service = createServiceClient();
  const { error } = await service.rpc("eliminar_zona", {
    p_tienda: tienda.id,
    p_zona: id,
    p_user: staff.userId,
  });
  if (error) lanzar(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "envio.zona.baja",
    detalle: { zona_id: id },
  });
}

export function tarifaDesdeFormulario(datos: FormData) {
  const id = String(datos.get("id") ?? "");
  return {
    id: id ? uuid(id, "Tarifa no encontrada.") : null,
    sucursalId: uuid(datos.get("sucursalId"), "La sucursal no pertenece a la tienda."),
    hastaKm: parseHastaKm(datos.get("hastaKm")),
    costo: parseCostoEnvio(datos.get("costo")),
  };
}

export function zonaDesdeFormulario(datos: FormData) {
  const id = String(datos.get("id") ?? "");
  const tipo = parseTipoZona(datos.get("tipo"));
  const punto = parseCoordenadaCliente(datos.get("lat"), datos.get("lng"));
  return {
    id: id ? uuid(id, "Zona no encontrada.") : null,
    sucursalId: uuid(datos.get("sucursalId"), "La sucursal no pertenece a la tienda."),
    nombre: parseNombreZona(datos.get("nombre")),
    lat: punto.lat,
    lng: punto.lng,
    radioKm: parseRadioKm(datos.get("radioKm")),
    tipo,
    costo: tipo === "bloqueada" ? null : parseCostoEnvio(datos.get("costo")),
    activa: datos.get("activa") === "on",
  };
}

/** El costo sale de la sucursal guardada. No usa distancia ni precio enviados por el navegador. */
export async function calcularEnvio(sucursalId: string, destino: Punto): Promise<ResultadoEnvio> {
  if (!esUuid(sucursalId)) throw new NegocioError("La sucursal no pertenece a la tienda.");
  const service = createServiceClient();
  const { data: sucursal, error } = await service
    .from("sucursales")
    .select("id, tienda_id, lat, lng, activa")
    .eq("id", sucursalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = sucursal as { id: string; tienda_id: string; lat: number | null; lng: number | null; activa: boolean } | null;
  if (!fila) throw new NoEncontrado();
  if (fila.lat == null || fila.lng == null) return { disponible: false, motivo: "sin_ubicacion" };

  const [zonasRes, tarifasRes] = await Promise.all([
    service
      .from("zonas_reparto")
      .select("tipo, lat_centro, lng_centro, radio_km, costo, activa")
      .eq("sucursal_id", fila.id)
      .eq("tienda_id", fila.tienda_id),
    service
      .from("tarifas_envio")
      .select("hasta_km, costo")
      .eq("sucursal_id", fila.id)
      .eq("tienda_id", fila.tienda_id),
  ]);
  if (zonasRes.error) throw new Error(zonasRes.error.message);
  if (tarifasRes.error) throw new Error(tarifasRes.error.message);

  const zona = resolverZona(
    destino,
    ((zonasRes.data ?? []) as FilaZona[]).map((item) => ({
      tipo: item.tipo === "bloqueada" ? "bloqueada" : "tarifa_fija",
      lat: item.lat_centro,
      lng: item.lng_centro,
      radioKm: Number(item.radio_km),
      costo: item.costo == null ? null : Number(item.costo),
      activa: item.activa,
    })),
  );
  if (zona?.tipo === "bloqueada") return { disponible: false, motivo: "fuera_de_zona" };
  if (zona?.tipo === "tarifa_fija") {
    return {
      disponible: true,
      costo: zona.costo,
      distanciaKm: Math.round(zona.distanciaKm * 10) / 10,
      origen: "zona",
      metodo: "haversine",
    };
  }

  const calle = await distanciaCalleOHaversine({ lat: fila.lat, lng: fila.lng }, destino);
  const costo = elegirTarifa(
    calle.km,
    ((tarifasRes.data ?? []) as { hasta_km: number | string; costo: number | string }[]).map((item) => ({
      hastaKm: Number(item.hasta_km),
      costo: Number(item.costo),
    })),
  );
  if (costo == null) return { disponible: false, motivo: "fuera_de_zona" };
  return {
    disponible: true,
    costo,
    distanciaKm: Math.round(calle.km * 10) / 10,
    origen: "tarifa",
    metodo: calle.metodo,
  };
}

async function exigir(slug: string, sucursalId: string | null, roles: readonly RolTienda[]) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId, roles });
  return { tienda, staff };
}

async function sucursalesPermitidas(miembroId: string, rol: RolTienda, tiendaId: string) {
  const service = createServiceClient();
  if (rol === "dueno") {
    const { data, error } = await service.from("sucursales").select("id").eq("tienda_id", tiendaId);
    if (error) throw new Error(error.message);
    return new Set(((data ?? []) as { id: string }[]).map((fila) => fila.id));
  }
  const { data, error } = await service.from("miembro_sucursales").select("sucursal_id").eq("miembro_id", miembroId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { sucursal_id: string }[]).map((fila) => fila.sucursal_id));
}

function uuid(valor: unknown, mensaje: string): string {
  const id = String(valor ?? "");
  if (!esUuid(id)) throw new NegocioError(mensaje);
  return id;
}

function lanzar(mensaje: string): never {
  const conocidos = [
    "El rango en kilómetros no es válido.",
    "El costo no puede ser negativo.",
    "La sucursal no pertenece a la tienda.",
    "Ese rango ya existe.",
    "Tarifa no encontrada.",
    "Escribe el nombre de la zona.",
    "El tipo de zona no es válido.",
    "El radio no es válido.",
    "La latitud tiene que estar entre -90 y 90.",
    "Zona no encontrada.",
  ];
  for (const texto of conocidos) {
    if (mensaje.includes(texto)) {
      if (texto === "Tarifa no encontrada." || texto === "Zona no encontrada.") throw new NoEncontrado();
      throw new NegocioError(texto);
    }
  }
  throw new Error(mensaje);
}

type FilaTarifa = {
  id: string;
  tienda_id: string;
  sucursal_id: string;
  hasta_km: number | string;
  costo: number | string;
};

type FilaZona = {
  id: string;
  tienda_id: string;
  sucursal_id: string;
  nombre: string;
  lat_centro: number;
  lng_centro: number;
  radio_km: number | string;
  tipo: string;
  costo: number | string | null;
  activa: boolean;
};
