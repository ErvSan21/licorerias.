import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { requireSuperAdmin } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/service";
import { capitalizar } from "@/lib/texto";
import {
  esPlazo,
  esUuid,
  etiquetaPlazo,
  hoyBolivia,
  NegocioError,
  parseCorreo,
  parseMonto,
  sumarDias,
  vencePronto,
} from "@/lib/licencias/reglas";
import { listarTiendas, suspenderLicencia, type TiendaLicencia } from "@/lib/licencias/servicio";
import { reporteDesdeJson } from "@/lib/reportes/reglas";
import { horarioTodoElDia } from "@/lib/sucursales/reglas";
import { esRolTienda, slugReservado } from "@/lib/tenant";

import {
  CLAVES_PRECIO,
  slugDeTienda,
  type ClavePrecio,
  type PreciosSuscripcion,
  type UsuarioOrganizacion,
} from "./reglas";

const CORREO_SOLO_PLATAFORMA = "ervinsanchez4321602@gmail.com";
const USUARIO_SOLO_PLATAFORMA = "7a7f8c94-b00b-4ee5-9604-1b0715bf4f4c";

export type { PreciosSuscripcion, UsuarioOrganizacion } from "./reglas";
export { etiquetaTipo, fechaAlta } from "./reglas";

export type IngresosSuscripcion = Record<ClavePrecio, number>;

export type MetricaTienda = {
  id: string;
  nombre: string;
  pedidos: number;
  ventas: number;
  ticket: number;
  cancelados: number;
  inventario: number;
};

export type Tablero = {
  registradas: number;
  porVencer: { id: string; nombre: string; vence: string }[];
  metricas: MetricaTienda[];
  totales: { pedidos: number; ventas: number; cancelados: number; inventario: number };
  ingresos: IngresosSuscripcion;
  precios: PreciosSuscripcion;
  desde: string;
  hasta: string;
};

const CEROS: PreciosSuscripcion = { mensual: 0, trimestral: 0, anual: 0, demo: 0 };

export async function leerTablero(): Promise<Tablero> {
  await requireSuperAdmin();
  const hoy = hoyBolivia();
  const hasta = hoy;
  const desde = sumarDias(hoy, -29);
  const [tiendas, ingresos, precios, metricas] = await Promise.all([
    listarTiendas(),
    leerIngresos(),
    leerPrecios(),
    leerMetricas(desde, hasta),
  ]);
  const porVencer = tiendas.flatMap((tienda) => {
    if (!proximaAVencer(tienda, hoy) || !tienda.licencia?.vence) return [];
    return [{ id: tienda.id, nombre: tienda.nombre, vence: tienda.licencia.vence }];
  });
  const totales = metricas.reduce(
    (acum, fila) => ({
      pedidos: acum.pedidos + fila.pedidos,
      ventas: acum.ventas + fila.ventas,
      cancelados: acum.cancelados + fila.cancelados,
      inventario: acum.inventario + fila.inventario,
    }),
    { pedidos: 0, ventas: 0, cancelados: 0, inventario: 0 },
  );
  return {
    registradas: tiendas.length,
    porVencer,
    metricas,
    totales,
    ingresos,
    precios,
    desde,
    hasta,
  };
}

export async function guardarPrecios(input: Record<ClavePrecio, string>): Promise<void> {
  const { userId } = await requireSuperAdmin();
  const precios = {
    mensual: exigirMonto(input.mensual, "mensual"),
    trimestral: exigirMonto(input.trimestral, "trimestral"),
    anual: exigirMonto(input.anual, "anual"),
    demo: exigirMonto(input.demo, "demo"),
  };
  const service = createServiceClient();
  const filas = CLAVES_PRECIO.map((clave) => ({ clave, precio: precios[clave] }));
  const { error } = await service.from("precios_suscripcion").upsert(filas);
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId,
    accion: "suscripcion.precios",
    detalle: precios,
  });
}

export async function inactivarTienda(tiendaId: string): Promise<void> {
  await suspenderLicencia(tiendaId);
}

export async function conteoSucursales(): Promise<Record<string, number>> {
  await requireSuperAdmin();
  const service = createServiceClient();
  const { data, error } = await service.from("sucursales").select("tienda_id");
  if (error) throw new Error(error.message);
  const conteo: Record<string, number> = {};
  for (const fila of (data ?? []) as { tienda_id: string }[]) {
    conteo[fila.tienda_id] = (conteo[fila.tienda_id] ?? 0) + 1;
  }
  return conteo;
}

export type PlanSuscripcion = {
  clave: ClavePrecio;
  nombre: string;
  precio: number;
};

export async function listarPlanesSuscripcion(): Promise<PlanSuscripcion[]> {
  await requireSuperAdmin();
  const service = createServiceClient();
  const { data, error } = await service.from("precios_suscripcion").select("clave, nombre, precio");
  if (error) throw new Error(error.message);
  const orden = new Map(CLAVES_PRECIO.map((clave, indice) => [clave, indice]));
  const planes = ((data ?? []) as { clave: string; nombre: string | null; precio: number | string }[]).flatMap((fila) => {
    if (!esClavePrecio(fila.clave) || !esPlazo(fila.clave)) return [];
    const nombre = fila.nombre?.trim() || etiquetaPlazo(fila.clave);
    return [{ clave: fila.clave, nombre, precio: Number(fila.precio) || 0 }];
  });
  planes.sort((a, b) => (orden.get(a.clave) ?? 9) - (orden.get(b.clave) ?? 9));
  return planes;
}

export async function guardarPlanSuscripcion(input: {
  claveActual: string;
  nombre: string;
  duracion: string;
  costo: string;
}): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esClavePrecio(input.claveActual)) throw new NegocioError("Ese plan no existe.");
  if (!esPlazo(input.duracion)) throw new NegocioError("Elige una duración.");
  const nombre = capitalizar(input.nombre.trim());
  if (!nombre || nombre.length > 40) throw new NegocioError("El nombre tiene que tener entre 1 y 40 caracteres.");
  const precio = parseMonto(input.costo);
  if (precio == null) throw new NegocioError("El costo no es válido.");
  const service = createServiceClient();
  if (input.duracion !== input.claveActual) {
    const { data: ocupada, error: errorOcupada } = await service
      .from("precios_suscripcion")
      .select("clave")
      .eq("clave", input.duracion)
      .maybeSingle();
    if (errorOcupada) throw new Error(errorOcupada.message);
    if (ocupada) throw new NegocioError("Ya hay un plan con esa duración.");
  }
  const { data, error } = await service
    .from("precios_suscripcion")
    .update({ clave: input.duracion, nombre, precio })
    .eq("clave", input.claveActual)
    .select("clave")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new NegocioError("Ese plan no existe.");
  await registrarAuditoria({
    userId,
    accion: "suscripcion.plan",
    detalle: { clave: input.duracion, nombre, precio },
  });
}

export async function eliminarPlanSuscripcion(clave: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esClavePrecio(clave)) throw new NegocioError("Ese plan no existe.");
  const service = createServiceClient();
  const { data, error } = await service.from("precios_suscripcion").delete().eq("clave", clave).select("clave").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new NegocioError("Ese plan no existe.");
  await registrarAuditoria({
    userId,
    accion: "suscripcion.plan.eliminar",
    detalle: { clave },
  });
}

export async function crearTiendaAdministracion(input: {
  nombre: string;
  direccion: string;
  sucursalesHabilitadas: boolean;
}): Promise<{ id: string; slug: string }> {
  const { userId } = await requireSuperAdmin();
  const nombre = capitalizar(input.nombre.trim());
  if (nombre.length < 2 || nombre.length > 80) throw new NegocioError("Escribe el nombre de la tienda.");
  const direccion = capitalizar(input.direccion.trim());
  if (direccion.length < 4 || direccion.length > 200) throw new NegocioError("Escribe la dirección de la tienda.");
  const sucursalesHabilitadas = input.sucursalesHabilitadas === true;
  const service = createServiceClient();

  // Plan sin tope de sucursales: el límite lo pone sucursales_habilitadas.
  const { data: planFila, error: errorPlan } = await service
    .from("planes")
    .select("id")
    .eq("activo", true)
    .order("max_sucursales", { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (errorPlan) throw new Error(errorPlan.message);
  const plan = planFila as { id: string } | null;
  if (!plan) throw new NegocioError("No hay un plan activo para la licencia.");

  let tienda: { id: string; slug: string } | null = null;
  for (let sufijo = 1; sufijo <= 20 && !tienda; sufijo++) {
    const slug = slugDeTienda(nombre, sufijo);
    if (slugReservado(slug)) continue;
    const { data, error } = await service
      .from("tiendas")
      .insert({ nombre, slug, estado: "activa", sucursales_habilitadas: sucursalesHabilitadas })
      .select("id, slug")
      .single();
    if (error?.code === "23505") continue;
    if (error?.message.includes("sucursales_habilitadas")) {
      throw new NegocioError("Falta aplicar la migración de sucursales en la base de datos.");
    }
    if (error || !data) throw new Error(error?.message ?? "No se pudo crear la tienda.");
    tienda = data as { id: string; slug: string };
  }
  if (!tienda) throw new NegocioError("Ya hay muchas tiendas con ese nombre. Prueba con otro.");

  try {
    const { error: errorLicencia } = await service.from("licencias").insert({
      tienda_id: tienda.id,
      plan_id: plan.id,
      estado: "prueba",
      plazo: "demo",
      inicio: hoyBolivia(),
      vence: null,
      dias_gracia: 0,
    });
    if (errorLicencia) throw new Error(errorLicencia.message);

    const { error: errorSucursal } = await service.from("sucursales").insert({
      tienda_id: tienda.id,
      slug: "principal",
      nombre: "Principal",
      direccion,
      horario: horarioTodoElDia(),
      activa: true,
      orden: 1,
    });
    if (errorSucursal) throw new Error(errorSucursal.message);
  } catch (causa) {
    await service.from("tiendas").delete().eq("id", tienda.id);
    throw causa;
  }

  await registrarAuditoria({
    userId,
    tiendaId: tienda.id,
    accion: "administracion.tienda.crear",
    detalle: { slug: tienda.slug, sucursales_habilitadas: sucursalesHabilitadas },
  });
  return tienda;
}

export async function eliminarTienda(tiendaId: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(tiendaId)) throw new NegocioError("Tienda no encontrada.");
  const service = createServiceClient();
  const { data, error } = await service.from("tiendas").select("id, nombre").eq("id", tiendaId).maybeSingle();
  if (error) throw new Error(error.message);
  const tienda = data as { id: string; nombre: string } | null;
  if (!tienda) throw new NegocioError("Tienda no encontrada.");

  const pagos = await service.from("pagos_licencia").delete().eq("tienda_id", tiendaId);
  if (pagos.error) throw new Error(pagos.error.message);
  const auditoria = await service.from("auditoria").delete().eq("tienda_id", tiendaId);
  if (auditoria.error) throw new Error(auditoria.error.message);
  const pedidos = await service.from("pedidos").delete().eq("tienda_id", tiendaId);
  if (pedidos.error) throw new Error(pedidos.error.message);
  const productos = await service.from("productos").update({ categoria_id: null }).eq("tienda_id", tiendaId);
  if (productos.error) throw new Error(productos.error.message);
  const borrada = await service.from("tiendas").delete().eq("id", tiendaId);
  if (borrada.error) throw new Error(borrada.error.message);

  await registrarAuditoria({
    userId,
    accion: "administracion.tienda.eliminar",
    detalle: { tienda_id: tiendaId, nombre: tienda.nombre },
  });
}

export async function listarUsuarios(): Promise<{
  tiendas: { id: string; nombre: string }[];
  usuarios: UsuarioOrganizacion[];
}> {
  await requireSuperAdmin();
  const service = createServiceClient();
  const [tiendasRes, miembrosRes] = await Promise.all([
    service.from("tiendas").select("id, nombre").order("nombre"),
    service.from("miembros").select("id, user_id, rol, activo, tienda_id").order("activo", { ascending: false }),
  ]);
  if (tiendasRes.error) throw new Error(tiendasRes.error.message);
  if (miembrosRes.error) throw new Error(miembrosRes.error.message);
  const tiendas = ((tiendasRes.data ?? []) as { id: string; nombre: string }[]).map((tienda) => ({
    id: tienda.id,
    nombre: tienda.nombre,
  }));
  const nombres = new Map(tiendas.map((tienda) => [tienda.id, tienda.nombre]));
  const filas = (miembrosRes.data ?? []) as {
    id: string;
    user_id: string;
    rol: string;
    activo: boolean;
    tienda_id: string;
  }[];
  const correos = await correosDe(filas.map((fila) => fila.user_id));
  const usuarios = filas.flatMap((fila) => {
    if (!esRolTienda(fila.rol)) return [];
    const tiendaNombre = nombres.get(fila.tienda_id);
    if (!tiendaNombre) return [];
    return [
      {
        miembroId: fila.id,
        userId: fila.user_id,
        correo: correos.get(fila.user_id) ?? null,
        rol: fila.rol,
        activo: fila.activo,
        tiendaId: fila.tienda_id,
        tiendaNombre,
      },
    ];
  });
  usuarios.sort((a, b) => a.tiendaNombre.localeCompare(b.tiendaNombre, "es") || (a.correo ?? "").localeCompare(b.correo ?? "", "es"));
  return { tiendas, usuarios };
}

export async function crearUsuarioOrganizacion(input: {
  tiendaId: string;
  tipo: string;
  correo: string;
  contrasena: string;
}): Promise<void> {
  const { userId } = await requireSuperAdmin();
  if (!esUuid(input.tiendaId)) throw new NegocioError("Elige una tienda.");
  const correo = parseCorreo(input.correo);
  if (!correo) throw new NegocioError("Escribe un correo válido.");
  if (correo === CORREO_SOLO_PLATAFORMA) {
    throw new NegocioError("Ese correo es solo de administración y no pertenece a una tienda.");
  }
  const rol = rolDeTipo(input.tipo);
  const contrasena = input.contrasena;
  if (contrasena.length < 8 || contrasena.length > 72) {
    throw new NegocioError("La contraseña tiene que tener entre 8 y 72 caracteres.");
  }
  const service = createServiceClient();
  const tienda = await tiendaSimple(input.tiendaId);
  const usuario = await buscarOCrearUsuario(correo, contrasena);
  if (usuario.id === USUARIO_SOLO_PLATAFORMA) {
    throw new NegocioError("Ese correo es solo de administración y no pertenece a una tienda.");
  }
  const { data: existente, error: errorExistente } = await service
    .from("miembros")
    .select("id")
    .eq("tienda_id", tienda.id)
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (errorExistente) throw new Error(errorExistente.message);
  if (existente) throw new NegocioError("Esa persona ya está en la tienda.");
  if (!usuario.nuevo) {
    const actualizado = await service.auth.admin.updateUserById(usuario.id, { password: contrasena });
    if (actualizado.error) throw new Error(actualizado.error.message);
  }
  const { error } = await service.from("miembros").insert({
    user_id: usuario.id,
    tienda_id: tienda.id,
    rol,
    activo: true,
  });
  if (error) lanzarCupo(error.message);
  await registrarAuditoria({
    userId,
    tiendaId: tienda.id,
    accion: "administracion.usuario.crear",
    detalle: { rol },
  });
}

export async function bloquearUsuario(miembroId: string, bloquear: boolean): Promise<void> {
  const { userId } = await requireSuperAdmin();
  const miembro = await miembroDe(miembroId);
  if (miembro.userId === USUARIO_SOLO_PLATAFORMA || miembro.userId === userId) {
    throw new NegocioError("Esa cuenta no se bloquea desde aquí.");
  }
  const service = createServiceClient();
  const { error } = await service.from("miembros").update({ activo: !bloquear }).eq("id", miembro.miembroId);
  if (error) lanzarCupo(error.message);
  const bloqueo = await service.auth.admin.updateUserById(miembro.userId, {
    ban_duration: bloquear ? "876000h" : "none",
  });
  if (bloqueo.error) throw new Error(bloqueo.error.message);
  await registrarAuditoria({
    userId,
    tiendaId: miembro.tiendaId,
    accion: bloquear ? "administracion.usuario.bloquear" : "administracion.usuario.desbloquear",
    detalle: { miembro_id: miembro.miembroId },
  });
}

export async function borrarUsuario(miembroId: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  const miembro = await miembroDe(miembroId);
  if (miembro.userId === USUARIO_SOLO_PLATAFORMA || miembro.userId === userId) {
    throw new NegocioError("Esa cuenta no se borra desde aquí.");
  }
  if (await esSuperAdmin(miembro.userId)) {
    throw new NegocioError("Una cuenta de administración no se borra desde aquí.");
  }
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(miembro.userId);
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId,
    tiendaId: miembro.tiendaId,
    accion: "administracion.usuario.borrar",
    detalle: { rol: miembro.rol },
  });
}

export async function cambiarContrasenaUsuario(miembroId: string, contrasena: string): Promise<void> {
  const { userId } = await requireSuperAdmin();
  const miembro = await miembroDe(miembroId);
  if (miembro.userId === USUARIO_SOLO_PLATAFORMA) {
    throw new NegocioError("Esa cuenta no se cambia desde aquí.");
  }
  if (contrasena.length < 8 || contrasena.length > 72) {
    throw new NegocioError("La contraseña tiene que tener entre 8 y 72 caracteres.");
  }
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(miembro.userId, { password: contrasena });
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId,
    tiendaId: miembro.tiendaId,
    accion: "administracion.usuario.contrasena",
    detalle: { miembro_id: miembro.miembroId },
  });
}

function proximaAVencer(tienda: TiendaLicencia, hoy: string): boolean {
  if (tienda.estado !== "activa" || !tienda.licencia) return false;
  if (tienda.licencia.estado !== "prueba" && tienda.licencia.estado !== "activa") return false;
  return vencePronto(tienda.licencia.vence, hoy);
}

async function leerPrecios(): Promise<PreciosSuscripcion> {
  const service = createServiceClient();
  const { data, error } = await service.from("precios_suscripcion").select("clave, precio");
  if (error) throw new Error(error.message);
  const precios = { ...CEROS };
  for (const fila of (data ?? []) as { clave: string; precio: number | string }[]) {
    if (!esClavePrecio(fila.clave)) continue;
    precios[fila.clave] = Number(fila.precio);
  }
  return precios;
}

async function leerIngresos(): Promise<IngresosSuscripcion> {
  const service = createServiceClient();
  const [pagosRes, licenciasRes] = await Promise.all([
    service.from("pagos_licencia").select("monto, periodo_desde, periodo_hasta, tienda_id"),
    service.from("licencias").select("tienda_id, plazo"),
  ]);
  if (pagosRes.error) throw new Error(pagosRes.error.message);
  if (licenciasRes.error) throw new Error(licenciasRes.error.message);
  const plazoPorTienda = new Map(
    ((licenciasRes.data ?? []) as { tienda_id: string; plazo: string }[]).map((fila) => [fila.tienda_id, fila.plazo]),
  );
  const ingresos = { ...CEROS };
  for (const fila of (pagosRes.data ?? []) as {
    monto: number | string;
    periodo_desde: string;
    periodo_hasta: string;
    tienda_id: string;
  }[]) {
    const clave =
      plazoPorTienda.get(fila.tienda_id) === "demo"
        ? "demo"
        : clavePorPeriodo(String(fila.periodo_desde).slice(0, 10), String(fila.periodo_hasta).slice(0, 10));
    ingresos[clave] += Number(fila.monto) || 0;
  }
  return ingresos;
}

async function leerMetricas(desde: string, hasta: string): Promise<MetricaTienda[]> {
  const service = createServiceClient();
  const [tiendasRes, sucursalesRes] = await Promise.all([
    service.from("tiendas").select("id, nombre").order("nombre"),
    service.from("sucursales").select("id, tienda_id"),
  ]);
  if (tiendasRes.error) throw new Error(tiendasRes.error.message);
  if (sucursalesRes.error) throw new Error(sucursalesRes.error.message);
  const porTienda = new Map<string, string[]>();
  for (const fila of (sucursalesRes.data ?? []) as { id: string; tienda_id: string }[]) {
    const lista = porTienda.get(fila.tienda_id) ?? [];
    lista.push(fila.id);
    porTienda.set(fila.tienda_id, lista);
  }
  const tiendas = (tiendasRes.data ?? []) as { id: string; nombre: string }[];
  return Promise.all(
    tiendas.map(async (tienda) => {
      const { data, error } = await service.rpc("reporte_tienda", {
        p_tienda: tienda.id,
        p_sucursales: porTienda.get(tienda.id) ?? [],
        p_desde: desde,
        p_hasta: hasta,
      });
      if (error) throw new Error(error.message);
      const reporte = reporteDesdeJson(data);
      const inventario = reporte.inventario.reduce((suma, fila) => suma + fila.valor, 0);
      return {
        id: tienda.id,
        nombre: tienda.nombre,
        pedidos: reporte.pedidos,
        ventas: reporte.ventas,
        ticket: reporte.ticket,
        cancelados: reporte.cancelados,
        inventario,
      };
    }),
  );
}

function clavePorPeriodo(desde: string, hasta: string): Exclude<ClavePrecio, "demo"> {
  const inicio = Date.parse(`${desde}T12:00:00.000Z`);
  const fin = Date.parse(`${hasta}T12:00:00.000Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return "mensual";
  const dias = Math.round((fin - inicio) / 86_400_000);
  if (dias <= 45) return "mensual";
  if (dias <= 120) return "trimestral";
  return "anual";
}

function exigirMonto(texto: string, etiqueta: string): number {
  const monto = parseMonto(texto);
  if (monto == null) throw new NegocioError(`El precio de ${etiqueta} no es válido.`);
  return monto;
}

function esClavePrecio(valor: string): valor is ClavePrecio {
  return (CLAVES_PRECIO as readonly string[]).includes(valor);
}

function rolDeTipo(tipo: string): "dueno" | "vendedor" {
  if (tipo === "admin") return "dueno";
  if (tipo === "ventas") return "vendedor";
  throw new NegocioError("Elige admin o ventas.");
}

async function buscarOCrearUsuario(correo: string, contrasena: string): Promise<{ id: string; nuevo: boolean }> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("usuario_id_por_correo", { p_correo: correo });
  if (error) throw new Error(error.message);
  if (typeof data === "string" && esUuid(data)) {
    if (data === USUARIO_SOLO_PLATAFORMA) {
      throw new NegocioError("Ese correo es solo de administración y no pertenece a una tienda.");
    }
    return { id: data, nuevo: false };
  }
  const creado = await service.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
  });
  if (!creado.error && creado.data.user?.id) {
    if (creado.data.user.id === USUARIO_SOLO_PLATAFORMA) {
      throw new NegocioError("Ese correo es solo de administración y no pertenece a una tienda.");
    }
    return { id: creado.data.user.id, nuevo: true };
  }
  console.error("crear usuario", creado.error?.message ?? "sin usuario");
  throw new NegocioError("No se pudo crear el usuario. Revisa el correo e inténtalo de nuevo.");
}

async function miembroDe(miembroId: string): Promise<UsuarioOrganizacion> {
  if (!esUuid(miembroId)) throw new NegocioError("Esa persona no existe.");
  const service = createServiceClient();
  const { data, error } = await service
    .from("miembros")
    .select("id, user_id, rol, activo, tienda_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string; user_id: string; rol: string; activo: boolean; tienda_id: string } | null;
  if (!fila || !esRolTienda(fila.rol)) throw new NegocioError("Esa persona no existe.");
  const { data: tienda, error: errorTienda } = await service
    .from("tiendas")
    .select("nombre")
    .eq("id", fila.tienda_id)
    .maybeSingle();
  if (errorTienda) throw new Error(errorTienda.message);
  const nombre = (tienda as { nombre: string } | null)?.nombre;
  if (!nombre) throw new NegocioError("Esa persona no existe.");
  return {
    miembroId: fila.id,
    userId: fila.user_id,
    correo: null,
    rol: fila.rol,
    activo: fila.activo,
    tiendaId: fila.tienda_id,
    tiendaNombre: nombre,
  };
}

async function esSuperAdmin(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function tiendaSimple(tiendaId: string): Promise<{ id: string }> {
  const service = createServiceClient();
  const { data, error } = await service.from("tiendas").select("id").eq("id", tiendaId).maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string } | null;
  if (!fila) throw new NegocioError("Elige una tienda.");
  return fila;
}

async function correosDe(ids: string[]): Promise<Map<string, string | null>> {
  const service = createServiceClient();
  const unicos = [...new Set(ids)];
  const pares = await Promise.all(
    unicos.map(async (id) => {
      const { data, error } = await service.auth.admin.getUserById(id);
      if (error) return [id, null] as const;
      return [id, data.user?.email ?? null] as const;
    }),
  );
  return new Map(pares);
}

function lanzarCupo(mensaje: string): never {
  const cupo = mensaje.match(/Has alcanzado el máximo de .+ de tu plan/);
  if (cupo) throw new NegocioError(cupo[0]);
  throw new Error(mensaje);
}
