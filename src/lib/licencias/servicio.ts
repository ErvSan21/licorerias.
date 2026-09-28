import "server-only";

import { cache } from "react";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { requireSuperAdmin } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/service";
import {
  esEstadoTienda,
  normalizarSlug,
  slugReservado,
  slugValido,
  type EstadoTienda,
} from "@/lib/tenant";

import {
  esEstadoLicencia,
  esMetodoPago,
  esPlazo,
  esUuid,
  fechaValida,
  hoyBolivia,
  NegocioError,
  parseCorreo,
  parseEntero,
  parseMonto,
  sumarDias,
  type EstadoLicencia,
  type MetodoPago,
  type Plazo,
} from "./reglas";

export type PlanResumen = {
  id: string;
  nombre: string;
  precioMensual: number;
  maxSucursales: number | null;
  maxProductos: number | null;
  maxUsuarios: number | null;
  activo: boolean;
};

export type LicenciaResumen = {
  id: string;
  estado: EstadoLicencia;
  inicio: string;
  vence: string | null;
  plazo: Plazo;
  diasGracia: number;
  notas: string | null;
  plan: PlanResumen;
};

export type TiendaLicencia = {
  id: string;
  slug: string;
  nombre: string;
  estado: EstadoTienda;
  creadoEn: string;
  licencia: LicenciaResumen | null;
};

export type PagoResumen = {
  id: string;
  monto: number;
  fecha: string;
  metodo: MetodoPago;
  referencia: string | null;
  periodoDesde: string;
  periodoHasta: string;
};

export type MiembroResumen = {
  id: string;
  rol: string;
  activo: boolean;
  correo: string | null;
};

export type AuditoriaResumen = {
  id: string;
  accion: string;
  creadoEn: string;
};

export type AltaTienda = {
  nombre: string;
  slug: string;
  planId: string;
  correoDueno: string;
  diasPrueba: number;
  diasGracia: number;
};

export type AltaLicencia = {
  tiendaId: string;
  planId: string;
  diasPrueba: number;
  diasGracia: number;
};

export type PagoNuevo = {
  tiendaId: string;
  monto: string;
  fecha: string;
  metodo: string;
  referencia: string;
  periodoDesde: string;
  periodoHasta: string;
};

type FilaPlan = {
  id: string;
  nombre: string;
  precio_mensual: number | string;
  max_sucursales: number | null;
  max_productos: number | null;
  max_usuarios: number | null;
  activo: boolean;
};

type FilaLicencia = {
  id: string;
  estado: string;
  inicio: string;
  vence: string | null;
  plazo: string;
  dias_gracia: number;
  notas: string | null;
  plan_id: string;
  planes: FilaPlan | FilaPlan[] | null;
};

type FilaTienda = {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
  creado_en: string;
  licencias: FilaLicencia | FilaLicencia[] | null;
};

const SIN_CACHE = { headers: { "Cache-Control": "private, no-store" } };

export function cabecerasPrivadas(): HeadersInit {
  return SIN_CACHE.headers;
}

export async function licenciaVigente(tiendaId: string): Promise<boolean> {
  if (!esUuid(tiendaId)) return false;
  const service = createServiceClient();
  const { data, error } = await service.rpc("licencia_vigente", { p_tienda: tiendaId });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function exigirLicenciaParaEscribir(tiendaId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.rpc("exigir_licencia_vigente", { p_tienda: tiendaId });
  if (error) {
    if (error.message.includes("Tienda no disponible")) {
      throw new NegocioError("La licencia no está vigente. El panel está en solo lectura.");
    }
    throw new Error(error.message);
  }
}

export const listarPlanes = cache(async (): Promise<PlanResumen[]> => {
  const service = createServiceClient();
  const { data, error } = await service
    .from("planes")
    .select("id, nombre, precio_mensual, max_sucursales, max_productos, max_usuarios, activo")
    .eq("activo", true)
    .order("precio_mensual");

  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaPlan[]).flatMap((fila) => {
    const plan = planDesdeFila(fila);
    return plan ? [plan] : [];
  });
});

export async function listarTiendas(): Promise<TiendaLicencia[]> {
  await requireSuperAdmin();
  const service = createServiceClient();
  const { data, error } = await service
    .from("tiendas")
    .select(
      "id, slug, nombre, estado, creado_en, licencias(id, estado, inicio, vence, plazo, dias_gracia, notas, plan_id, planes(id, nombre, precio_mensual, max_sucursales, max_productos, max_usuarios, activo))",
    )
    .order("nombre");

  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaTienda[]).flatMap((fila) => {
    const tienda = tiendaDesdeFila(fila);
    return tienda ? [tienda] : [];
  });
}

export async function leerTiendaSuper(tiendaId: string): Promise<{
  tienda: TiendaLicencia;
  miembros: MiembroResumen[];
  pagos: PagoResumen[];
  auditoria: AuditoriaResumen[];
}> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");

  const service = createServiceClient();
  const tiendaPromesa = service
    .from("tiendas")
    .select(
      "id, slug, nombre, estado, creado_en, licencias(id, estado, inicio, vence, plazo, dias_gracia, notas, plan_id, planes(id, nombre, precio_mensual, max_sucursales, max_productos, max_usuarios, activo))",
    )
    .eq("id", tiendaId)
    .maybeSingle();
  const miembrosPromesa = service
    .from("miembros")
    .select("id, rol, activo, user_id")
    .eq("tienda_id", tiendaId);
  const pagosPromesa = service
    .from("pagos_licencia")
    .select("id, monto, fecha, metodo, referencia, periodo_desde, periodo_hasta")
    .eq("tienda_id", tiendaId)
    .order("fecha", { ascending: false });

  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "tienda.lectura",
    detalle: { origen: "super" },
  });

  const auditoriaPromesa = service
    .from("auditoria")
    .select("id, accion, creado_en")
    .eq("tienda_id", tiendaId)
    .order("creado_en", { ascending: false })
    .limit(8);

  const [tiendaRes, miembrosRes, pagosRes, auditoriaRes] = await Promise.all([
    tiendaPromesa,
    miembrosPromesa,
    pagosPromesa,
    auditoriaPromesa,
  ]);

  if (tiendaRes.error) throw new Error(tiendaRes.error.message);
  if (miembrosRes.error) throw new Error(miembrosRes.error.message);
  if (pagosRes.error) throw new Error(pagosRes.error.message);
  if (auditoriaRes.error) throw new Error(auditoriaRes.error.message);

  const tienda = tiendaDesdeFila(tiendaRes.data as FilaTienda | null);
  if (!tienda || tienda.id !== tiendaId) throw new NegocioError("Tienda no encontrada.");

  const filasMiembro = (miembrosRes.data ?? []) as {
    id: string;
    rol: string;
    activo: boolean;
    user_id: string;
  }[];
  const correos = await correosDe(filasMiembro.map((fila) => fila.user_id));
  const miembros = filasMiembro
    .map((fila) => ({
      id: fila.id,
      rol: fila.rol,
      activo: fila.activo,
      correo: correos.get(fila.user_id) ?? null,
    }))
    .toSorted((a, b) => Number(b.activo) - Number(a.activo));

  const pagos = ((pagosRes.data ?? []) as {
    id: string;
    monto: number | string;
    fecha: string;
    metodo: string;
    referencia: string | null;
    periodo_desde: string;
    periodo_hasta: string;
  }[]).flatMap((fila) => {
    if (!esMetodoPago(fila.metodo)) return [];
    return [
      {
        id: fila.id,
        monto: Number(fila.monto),
        fecha: fila.fecha,
        metodo: fila.metodo,
        referencia: fila.referencia,
        periodoDesde: fila.periodo_desde,
        periodoHasta: fila.periodo_hasta,
      },
    ];
  });

  const auditoria = ((auditoriaRes.data ?? []) as {
    id: string;
    accion: string;
    creado_en: string;
  }[]).map((fila) => ({
    id: fila.id,
    accion: fila.accion,
    creadoEn: fila.creado_en,
  }));

  return { tienda, miembros, pagos, auditoria };
}

export async function crearTienda(
  input: AltaTienda,
  origen: string | null,
): Promise<{ id: string; slug: string; invitacion: "enviada" | "sin_correo" | "existente" }> {
  const { userId } = await requireSuperAdmin();
  const alta = validarAlta(input);
  const plan = await planActivo(alta.planId);
  const service = createServiceClient();
  const hoy = hoyBolivia();
  const vence = sumarDias(hoy, alta.diasPrueba);

  const { data: creada, error } = await service
    .from("tiendas")
    .insert({ nombre: alta.nombre, slug: alta.slug, estado: "activa" })
    .select("id, slug")
    .single();

  if (error || !creada) {
    if (error?.code === "23505") throw new NegocioError("Ese identificador de tienda ya existe.");
    if (error?.code === "23514") throw new NegocioError("El identificador de tienda no es válido.");
    throw new Error(error?.message ?? "No se pudo crear la tienda.");
  }

  const tienda = creada as { id: string; slug: string };
  const { error: errorLicencia } = await service.from("licencias").insert({
    tienda_id: tienda.id,
    plan_id: plan.id,
    estado: "prueba",
    inicio: hoy,
    vence,
    dias_gracia: alta.diasGracia,
  });

  if (errorLicencia) {
    await service.from("tiendas").delete().eq("id", tienda.id);
    throw new Error(errorLicencia.message);
  }

  let dueno: { id: string; invitacion: "enviada" | "sin_correo" | "existente" };
  try {
    dueno = await asegurarDueno(alta.correoDueno, origen);
  } catch (causa) {
    await service.from("tiendas").delete().eq("id", tienda.id);
    throw causa;
  }

  const { error: errorMiembro } = await service.from("miembros").insert({
    user_id: dueno.id,
    tienda_id: tienda.id,
    rol: "dueno",
    activo: true,
  });

  if (errorMiembro) {
    await service.from("tiendas").delete().eq("id", tienda.id);
    throw new Error(errorMiembro.message);
  }

  await registrarAuditoria({
    userId,
    tiendaId: tienda.id,
    accion: "tienda.alta",
    detalle: { slug: tienda.slug, plan_id: plan.id },
  });

  return { id: tienda.id, slug: tienda.slug, invitacion: dueno.invitacion };
}

export async function asignarLicencia(input: AltaLicencia): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(input.tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const plan = await planActivo(input.planId);
  const diasPrueba = parseEntero(String(input.diasPrueba), 1, 90);
  const diasGracia = parseEntero(String(input.diasGracia), 0, 30);
  if (diasPrueba == null || diasGracia == null) {
    throw new NegocioError("Revisa los días de prueba y de gracia.");
  }

  const service = createServiceClient();
  const tienda = await tiendaExistente(input.tiendaId);
  const hoy = hoyBolivia();
  const { error } = await service.from("licencias").insert({
    tienda_id: tienda.id,
    plan_id: plan.id,
    estado: "prueba",
    inicio: hoy,
    vence: sumarDias(hoy, diasPrueba),
    dias_gracia: diasGracia,
  });

  if (error?.code === "23505") throw new NegocioError("Esta tienda ya tiene licencia.");
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    userId,
    tiendaId: tienda.id,
    accion: "licencia.asignar",
    detalle: { plan_id: plan.id },
  });
}

export async function cambiarPlan(tiendaId: string, planId: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const plan = await planActivo(planId);
  const service = createServiceClient();
  const { data, error } = await service
    .from("licencias")
    .update({ plan_id: plan.id })
    .eq("tienda_id", tiendaId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NegocioError("Esta tienda no tiene licencia.");

  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "licencia.plan",
    detalle: { plan_id: plan.id },
  });
}

export async function extenderLicencia(tiendaId: string, vence: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  if (!fechaValida(vence)) throw new NegocioError("La fecha de vencimiento no es válida.");
  const hoy = hoyBolivia();
  if (vence < hoy) throw new NegocioError("La nueva fecha tiene que ser hoy o posterior.");

  const service = createServiceClient();
  const actual = await licenciaDe(tiendaId);
  if (vence < actual.inicio) {
    throw new NegocioError("La nueva fecha no puede ser anterior al inicio.");
  }

  const estado = actual.estado === "vencida" ? "activa" : actual.estado;
  const plazo = actual.plazo === "demo" ? "mensual" : actual.plazo;
  const { error } = await service
    .from("licencias")
    .update({ vence, estado, plazo })
    .eq("id", actual.id);

  if (error) throw new Error(error.message);
  if (actual.estado === "vencida") {
    await service.from("tiendas").update({ estado: "activa" }).eq("id", tiendaId).neq("estado", "cancelada");
  }

  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "licencia.extender",
    detalle: { vence },
  });
}

export async function suspenderLicencia(tiendaId: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const service = createServiceClient();
  const tienda = await tiendaExistente(tiendaId);
  if (tienda.estado === "cancelada") {
    throw new NegocioError("Una tienda cancelada no se suspende: ya no opera.");
  }

  const { data, error } = await service
    .from("licencias")
    .update({ estado: "suspendida" })
    .eq("tienda_id", tiendaId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NegocioError("Esta tienda no tiene licencia.");

  const { error: errorTienda } = await service
    .from("tiendas")
    .update({ estado: "suspendida" })
    .eq("id", tiendaId);

  if (errorTienda) throw new Error(errorTienda.message);

  const { error: errorSucursales } = await service
    .from("sucursales")
    .update({ activa: false, abierta: false })
    .eq("tienda_id", tiendaId);
  if (errorSucursales) throw new Error(errorSucursales.message);

  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "licencia.suspender",
    detalle: {},
  });
}

export async function reactivarLicencia(tiendaId: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const actual = await licenciaDe(tiendaId);
  const hoy = hoyBolivia();
  if (actual.vence && hoy > sumarDias(actual.vence, actual.diasGracia)) {
    throw new NegocioError("Extiende la fecha antes de reactivar.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("licencias")
    .update({ estado: "activa" })
    .eq("id", actual.id);
  if (error) throw new Error(error.message);

  const { error: errorTienda } = await service
    .from("tiendas")
    .update({ estado: "activa" })
    .eq("id", tiendaId)
    .neq("estado", "cancelada");
  if (errorTienda) throw new Error(errorTienda.message);

  const { error: errorSucursales } = await service
    .from("sucursales")
    .update({ activa: true })
    .eq("tienda_id", tiendaId);
  if (errorSucursales) throw new Error(errorSucursales.message);

  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "licencia.reactivar",
    detalle: {},
  });
}

export async function registrarPago(input: PagoNuevo): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(input.tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const monto = parseMonto(input.monto);
  if (monto == null) throw new NegocioError("El monto no es válido.");
  if (!esMetodoPago(input.metodo)) throw new NegocioError("El método de pago no es válido.");
  if (!fechaValida(input.fecha) || !fechaValida(input.periodoDesde) || !fechaValida(input.periodoHasta)) {
    throw new NegocioError("Revisa las fechas del pago.");
  }
  if (input.periodoHasta < input.periodoDesde) {
    throw new NegocioError("El periodo termina antes de empezar.");
  }
  const referencia = input.referencia.trim();
  if (referencia.length > 80) throw new NegocioError("La referencia es demasiado larga.");

  const actual = await licenciaDe(input.tiendaId);
  const service = createServiceClient();
  const { data: pago, error } = await service
    .from("pagos_licencia")
    .insert({
      tienda_id: input.tiendaId,
      monto,
      fecha: input.fecha,
      metodo: input.metodo,
      referencia: referencia || null,
      periodo_desde: input.periodoDesde,
      periodo_hasta: input.periodoHasta,
      registrado_por: userId,
    })
    .select("id")
    .single();

  if (error || !pago) throw new Error(error?.message ?? "No se pudo registrar el pago.");

  const vence =
    actual.vence == null || input.periodoHasta > actual.vence ? input.periodoHasta : actual.vence;
  const plazo = actual.plazo === "demo" ? "mensual" : actual.plazo;
  const estado =
    actual.estado === "prueba" || actual.estado === "vencida" ? "activa" : actual.estado;
  const { error: errorLicencia } = await service
    .from("licencias")
    .update({ vence, estado, plazo })
    .eq("id", actual.id);
  if (errorLicencia) throw new Error(errorLicencia.message);

  if (estado === "activa") {
    await service.from("tiendas").update({ estado: "activa" }).eq("id", input.tiendaId).eq("estado", "suspendida");
  }

  await registrarAuditoria({
    userId,
    tiendaId: input.tiendaId,
    accion: "licencia.pago",
    detalle: { pago_id: (pago as { id: string }).id, monto, periodo_hasta: input.periodoHasta },
  });
}

export function tiendaParaApi(tienda: TiendaLicencia) {
  return {
    id: tienda.id,
    slug: tienda.slug,
    nombre: tienda.nombre,
    estado: tienda.estado,
    licencia: tienda.licencia
      ? {
          id: tienda.licencia.id,
          estado: tienda.licencia.estado,
          inicio: tienda.licencia.inicio,
          vence: tienda.licencia.vence,
          diasGracia: tienda.licencia.diasGracia,
          plan: {
            id: tienda.licencia.plan.id,
            nombre: tienda.licencia.plan.nombre,
            precioMensual: tienda.licencia.plan.precioMensual,
          },
        }
      : null,
  };
}

function validarAlta(input: AltaTienda): AltaTienda {
  const nombre = input.nombre.trim();
  const slug = normalizarSlug(input.slug);
  const correo = parseCorreo(input.correoDueno);
  const diasPrueba = parseEntero(String(input.diasPrueba), 1, 90);
  const diasGracia = parseEntero(String(input.diasGracia), 0, 30);
  if (nombre.length < 2 || nombre.length > 80) {
    throw new NegocioError("El nombre de la tienda tiene que tener entre 2 y 80 caracteres.");
  }
  if (!slugValido(slug) || slugReservado(slug)) {
    throw new NegocioError("El identificador de tienda no es válido.");
  }
  if (!correo) throw new NegocioError("El correo del dueño no es válido.");
  if (diasPrueba == null || diasGracia == null) {
    throw new NegocioError("Revisa los días de prueba y de gracia.");
  }
  if (!esUuid(input.planId)) throw new NegocioError("Elige un plan.");
  return { nombre, slug, planId: input.planId, correoDueno: correo, diasPrueba, diasGracia };
}

async function planActivo(planId: string): Promise<PlanResumen> {
  if (!esUuid(planId)) throw new NegocioError("Elige un plan.");
  const planes = await listarPlanes();
  const plan = planes.find((item) => item.id === planId);
  if (!plan) throw new NegocioError("Ese plan no está disponible.");
  return plan;
}

async function tiendaExistente(tiendaId: string): Promise<{ id: string; estado: EstadoTienda }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("tiendas")
    .select("id, estado")
    .eq("id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string; estado: string } | null;
  if (!fila || !esEstadoTienda(fila.estado)) throw new NegocioError("Tienda no encontrada.");
  return { id: fila.id, estado: fila.estado };
}

async function licenciaDe(tiendaId: string): Promise<LicenciaResumen> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("licencias")
    .select(
      "id, estado, inicio, vence, plazo, dias_gracia, notas, plan_id, planes(id, nombre, precio_mensual, max_sucursales, max_productos, max_usuarios, activo)",
    )
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const licencia = licenciaDesdeFila(data as FilaLicencia | null);
  if (!licencia) throw new NegocioError("Esta tienda no tiene licencia.");
  return licencia;
}

async function asegurarDueno(
  correo: string,
  origen: string | null,
): Promise<{ id: string; invitacion: "enviada" | "sin_correo" | "existente" }> {
  const service = createServiceClient();
  const redirectTo = origenSeguro(origen);
  const invitado = await service.auth.admin.inviteUserByEmail(
    correo,
    redirectTo ? { redirectTo: `${redirectTo}/login` } : undefined,
  );

  if (!invitado.error && invitado.data.user?.id) {
    return { id: invitado.data.user.id, invitacion: "enviada" };
  }

  const { data, error } = await service.rpc("usuario_id_por_correo", { p_correo: correo });
  if (error) throw new Error(error.message);
  if (typeof data === "string" && esUuid(data)) {
    return { id: data, invitacion: invitado.error ? "sin_correo" : "existente" };
  }

  console.error("invitar dueno", invitado.error?.message ?? "sin usuario");
  throw new NegocioError("No se pudo invitar al dueño. Revisa el correo e inténtalo de nuevo.");
}

async function correosDe(ids: string[]): Promise<Map<string, string | null>> {
  const service = createServiceClient();
  const pares = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await service.auth.admin.getUserById(id);
      if (error) return [id, null] as const;
      return [id, data.user?.email ?? null] as const;
    }),
  );
  return new Map(pares);
}

function origenSeguro(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function tiendaDesdeFila(fila: FilaTienda | null): TiendaLicencia | null {
  if (!fila || !esEstadoTienda(fila.estado)) return null;
  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.nombre,
    estado: fila.estado,
    creadoEn: fila.creado_en,
    licencia: licenciaDesdeFila(uno(fila.licencias)),
  };
}

function licenciaDesdeFila(fila: FilaLicencia | null): LicenciaResumen | null {
  if (!fila || !esEstadoLicencia(fila.estado)) return null;
  const plan = planDesdeFila(uno(fila.planes));
  if (!plan || !esPlazo(fila.plazo)) return null;
  const vence = fila.vence ? String(fila.vence).slice(0, 10) : null;
  return {
    id: fila.id,
    estado: fila.estado,
    inicio: String(fila.inicio).slice(0, 10),
    vence: fila.plazo === "demo" ? null : vence,
    plazo: fila.plazo,
    diasGracia: fila.dias_gracia,
    notas: fila.notas,
    plan,
  };
}

export async function guardarPlazoTienda(tiendaId: string, plazo: string, vence: string | null): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  if (!esPlazo(plazo)) throw new NegocioError("Elige un plan.");
  const actual = await licenciaDe(tiendaId);
  const service = createServiceClient();

  if (plazo === "demo") {
    const { error } = await service.from("licencias").update({ plazo: "demo", vence: null }).eq("id", actual.id);
    if (error) throw new Error(error.message);
    await registrarAuditoria({
      userId,
      tiendaId,
      accion: "licencia.plazo",
      detalle: { plazo: "demo" },
    });
    return;
  }

  if (!vence || !fechaValida(vence)) throw new NegocioError("La fecha de vencimiento no es válida.");
  const hoy = hoyBolivia();
  if (vence < hoy) throw new NegocioError("La nueva fecha tiene que ser hoy o posterior.");
  if (vence < actual.inicio) throw new NegocioError("La nueva fecha no puede ser anterior al inicio.");
  if (actual.vence && vence < actual.vence) {
    throw new NegocioError("La nueva fecha tiene que alargar el plan, no acortarlo.");
  }

  const estado = actual.estado === "vencida" ? "activa" : actual.estado;
  const { error } = await service.from("licencias").update({ plazo, vence, estado }).eq("id", actual.id);
  if (error) throw new Error(error.message);
  if (actual.estado === "vencida") {
    await service.from("tiendas").update({ estado: "activa" }).eq("id", tiendaId).neq("estado", "cancelada");
  }
  await registrarAuditoria({
    userId,
    tiendaId,
    accion: "licencia.plazo",
    detalle: { plazo, vence },
  });
}

function planDesdeFila(fila: FilaPlan | null): PlanResumen | null {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    precioMensual: Number(fila.precio_mensual),
    maxSucursales: fila.max_sucursales,
    maxProductos: fila.max_productos,
    maxUsuarios: fila.max_usuarios,
    activo: fila.activo,
  };
}

function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}
