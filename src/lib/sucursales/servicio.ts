import "server-only";

import { randomBytes } from "node:crypto";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { requireStaff, type Staff } from "@/lib/auth/staff";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { esUuid } from "@/lib/licencias/reglas";
import { createServiceClient } from "@/lib/supabase/service";
import { esRolTienda, normalizarSlug, ROLES_TIENDA, slugReservado, slugValido, type RolTienda } from "@/lib/tenant";

import {
  accesoSucursal,
  horarioPorDefecto,
  NegocioError,
  parseCoordenadas,
  parseCorreo,
  parseHorario,
  parseIdsSucursal,
  parseMinutos,
  parseRolPersonal,
  parseSlugSucursal,
  parseTelefono,
  type Horario,
} from "./reglas";

export type SucursalResumen = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  horario: Horario;
  abierta: boolean;
  minutosAnticipacionRecojo: number;
  aceptaDelivery: boolean;
  aceptaRecojo: boolean;
  activa: boolean;
  orden: number;
};

export type AltaSucursal = {
  nombre: string;
  slug: string;
  direccion: string;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  horario: Horario;
  abierta: boolean;
  minutosAnticipacionRecojo: number;
  aceptaDelivery: boolean;
  aceptaRecojo: boolean;
};

export type PersonaResumen = {
  id: string;
  userId: string;
  rol: RolTienda;
  activo: boolean;
  correo: string | null;
  sucursalIds: string[];
};

type FilaSucursal = {
  id: string;
  tienda_id: string;
  slug: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  horario: unknown;
  abierta: boolean;
  minutos_anticipacion_recojo: number;
  acepta_delivery: boolean;
  acepta_recojo: boolean;
  activa: boolean;
  orden: number;
};

const CAMPOS_SUCURSAL =
  "id, tienda_id, slug, nombre, direccion, telefono, lat, lng, horario, abierta, minutos_anticipacion_recojo, acepta_delivery, acepta_recojo, activa, orden";

export async function listarSucursalesVisibles(slug: string): Promise<{
  staff: Staff;
  sucursales: SucursalResumen[];
}> {
  const staff = await exigirPersonal(slug, null, ROLES_TIENDA);
  const sucursales = await sucursalesDe(staff);
  return { staff, sucursales: sucursales.filter((sucursal) => visible(staff, sucursal.id, sucursales)) };
}

export async function leerSucursal(slug: string, sucursalId: string): Promise<{
  staff: Staff;
  sucursal: SucursalResumen;
}> {
  const staff = await exigirPersonal(slug, sucursalId, ROLES_TIENDA);
  const sucursal = await sucursalDeTienda(staff.tiendaId, sucursalId);
  return { staff, sucursal };
}

export async function crearSucursal(slug: string, input: AltaSucursal): Promise<string> {
  const staff = await exigirPersonal(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  const datos = validarAlta(input);
  await slugLibre(staff.tiendaId, datos.slug, null);
  const service = createServiceClient();
  const { data: ordenFila } = await service
    .from("sucursales")
    .select("orden")
    .eq("tienda_id", staff.tiendaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((ordenFila as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await service
    .from("sucursales")
    .insert({
      tienda_id: staff.tiendaId,
      slug: datos.slug,
      nombre: datos.nombre,
      direccion: datos.direccion,
      telefono: datos.telefono,
      lat: datos.lat,
      lng: datos.lng,
      horario: datos.horario,
      abierta: datos.abierta,
      minutos_anticipacion_recojo: datos.minutosAnticipacionRecojo,
      acepta_delivery: datos.aceptaDelivery,
      acepta_recojo: datos.aceptaRecojo,
      activa: true,
      orden,
    })
    .select("id")
    .single();
  if (error) lanzarCupo(error.message);
  const id = (data as { id: string }).id;
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: "sucursal.alta",
    detalle: { sucursal_id: id },
  });
  return id;
}

export async function actualizarSucursal(
  slug: string,
  sucursalId: string,
  input: AltaSucursal & { activa: boolean },
): Promise<void> {
  const staff = await exigirPersonal(slug, sucursalId, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  const actual = await sucursalDeTienda(staff.tiendaId, sucursalId);
  const datos = validarAlta(input);
  await slugLibre(staff.tiendaId, datos.slug, sucursalId);
  const service = createServiceClient();
  const { error } = await service
    .from("sucursales")
    .update({
      slug: datos.slug,
      nombre: datos.nombre,
      direccion: datos.direccion,
      telefono: datos.telefono,
      lat: datos.lat,
      lng: datos.lng,
      horario: datos.horario,
      abierta: datos.abierta,
      minutos_anticipacion_recojo: datos.minutosAnticipacionRecojo,
      acepta_delivery: datos.aceptaDelivery,
      acepta_recojo: datos.aceptaRecojo,
      activa: input.activa,
    })
    .eq("id", sucursalId)
    .eq("tienda_id", staff.tiendaId);
  if (error) lanzarCupo(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: "sucursal.editar",
    detalle: { sucursal_id: sucursalId, antes_activa: actual.activa, activa: input.activa },
  });
}

export async function cambiarAbierta(slug: string, sucursalId: string, abierta: boolean): Promise<boolean> {
  const staff = await exigirPersonal(slug, sucursalId, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  const service = createServiceClient();
  const { error } = await service
    .from("sucursales")
    .update({ abierta })
    .eq("id", sucursalId)
    .eq("tienda_id", staff.tiendaId);
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: "sucursal.abierta",
    detalle: { sucursal_id: sucursalId, abierta },
  });
  return abierta;
}

export async function desactivarSucursal(slug: string, sucursalId: string): Promise<void> {
  const staff = await exigirPersonal(slug, sucursalId, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  const service = createServiceClient();
  const { error } = await service
    .from("sucursales")
    .update({ activa: false, abierta: false })
    .eq("id", sucursalId)
    .eq("tienda_id", staff.tiendaId);
  if (error) throw new Error(error.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: "sucursal.desactivar",
    detalle: { sucursal_id: sucursalId },
  });
}

export async function listarPersonal(slug: string): Promise<{
  staff: Staff;
  personas: PersonaResumen[];
  sucursales: SucursalResumen[];
}> {
  const staff = await exigirPersonal(slug, null, ["dueno"]);
  const service = createServiceClient();
  const [sucursales, miembros] = await Promise.all([
    sucursalesDe(staff),
    service
      .from("miembros")
      .select("id, user_id, rol, activo")
      .eq("tienda_id", staff.tiendaId)
      .order("activo", { ascending: false }),
  ]);
  if (miembros.error) throw new Error(miembros.error.message);
  const filas = (miembros.data ?? []) as {
    id: string;
    user_id: string;
    rol: string;
    activo: boolean;
  }[];
  const ids = filas.map((fila) => fila.id);
  const asignaciones = ids.length
    ? await service.from("miembro_sucursales").select("miembro_id, sucursal_id").in("miembro_id", ids)
    : { data: [], error: null };
  if (asignaciones.error) throw new Error(asignaciones.error.message);
  const porMiembro = new Map<string, string[]>();
  for (const fila of (asignaciones.data ?? []) as { miembro_id: string; sucursal_id: string }[]) {
    const lista = porMiembro.get(fila.miembro_id) ?? [];
    lista.push(fila.sucursal_id);
    porMiembro.set(fila.miembro_id, lista);
  }
  const correos = await correosDe(filas.map((fila) => fila.user_id));
  const personas = filas.flatMap((fila) => {
    if (!esRolTienda(fila.rol)) return [];
    return [
      {
        id: fila.id,
        userId: fila.user_id,
        rol: fila.rol,
        activo: fila.activo,
        correo: correos.get(fila.user_id) ?? null,
        sucursalIds: porMiembro.get(fila.id) ?? [],
      },
    ];
  });
  return { staff, personas, sucursales };
}

export async function invitarPersonal(
  slug: string,
  input: { correo: string; rol: string; sucursalIds: string[] },
  origen: string | null,
): Promise<{ aviso: string }> {
  const staff = await exigirPersonal(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  const correo = parseCorreo(input.correo);
  if (!correo) throw new NegocioError("Escribe un correo válido.");
  const rol = parseRolPersonal(input.rol);
  const sucursalIds = await sucursalesValidas(staff.tiendaId, parseIdsSucursal(input.sucursalIds), rol);
  const service = createServiceClient();
  const usuario = await asegurarUsuario(correo, origen);
  const { data: existente, error: errorExistente } = await service
    .from("miembros")
    .select("id, activo, user_id")
    .eq("tienda_id", staff.tiendaId)
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (errorExistente) throw new Error(errorExistente.message);
  const miembro = existente as { id: string; activo: boolean; user_id: string } | null;
  let miembroId = miembro?.id ?? "";
  if (!miembro) {
    const { data, error } = await service
      .from("miembros")
      .insert({ user_id: usuario.id, tienda_id: staff.tiendaId, rol, activo: true })
      .select("id")
      .single();
    if (error) lanzarCupo(error.message);
    miembroId = (data as { id: string }).id;
  } else {
    const { error } = await service
      .from("miembros")
      .update({ rol, activo: true })
      .eq("id", miembro.id)
      .eq("tienda_id", staff.tiendaId);
    if (error) lanzarCupo(error.message);
  }
  await reemplazarAsignaciones(miembroId, sucursalIds);
  const token = randomBytes(24).toString("hex");
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: errorInvitacion } = await service.from("invitaciones").insert({
    email: correo,
    tienda_id: staff.tiendaId,
    rol,
    sucursales: sucursalIds,
    token,
    expira,
  });
  if (errorInvitacion) throw new Error(errorInvitacion.message);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: "personal.invitar",
    detalle: { rol, sucursales: sucursalIds.length },
  });
  return {
    aviso:
      usuario.invitacion === "enviada"
        ? "Invitación enviada."
        : "La persona quedó en el personal. El correo de invitación puede no haberse enviado.",
  };
}

export async function actualizarPersonal(
  slug: string,
  miembroId: string,
  input: { rol: string; sucursalIds: string[]; activo: boolean },
): Promise<void> {
  const staff = await exigirPersonal(slug, null, ["dueno"]);
  await exigirLicenciaParaEscribir(staff.tiendaId);
  if (!esUuid(miembroId)) throw new NegocioError("Esa persona no existe.");
  if (miembroId === staff.miembroId && !input.activo) {
    throw new NegocioError("No puedes desactivarte a ti mismo.");
  }
  const rol = parseRolPersonal(input.rol);
  const sucursalIds = await sucursalesValidas(staff.tiendaId, parseIdsSucursal(input.sucursalIds), rol);
  const service = createServiceClient();
  const { data, error } = await service
    .from("miembros")
    .select("id, rol, activo")
    .eq("id", miembroId)
    .eq("tienda_id", staff.tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string; rol: string; activo: boolean } | null;
  if (!fila || !esRolTienda(fila.rol)) throw new NegocioError("Esa persona no está en esta tienda.");
  if (fila.rol === "dueno" && (rol !== "dueno" || !input.activo)) {
    await exigirOtroDueno(staff.tiendaId, miembroId);
  }
  const { error: errorUpdate } = await service
    .from("miembros")
    .update({ rol, activo: input.activo })
    .eq("id", miembroId)
    .eq("tienda_id", staff.tiendaId);
  if (errorUpdate) lanzarCupo(errorUpdate.message);
  await reemplazarAsignaciones(miembroId, rol === "dueno" ? [] : sucursalIds);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: staff.tiendaId,
    accion: input.activo ? "personal.editar" : "personal.desactivar",
    detalle: { miembro_id: miembroId, rol },
  });
}

export function altaDesdeFormulario(datos: FormData): AltaSucursal {
  const coordenadas = parseCoordenadas(String(datos.get("lat") ?? ""), String(datos.get("lng") ?? ""));
  return {
    nombre: texto(datos.get("nombre"), "Escribe el nombre de la sucursal.", 80),
    slug: parseSlugSucursal(String(datos.get("slug") ?? "")),
    direccion: textoOpcional(datos.get("direccion"), 160),
    telefono: parseTelefono(String(datos.get("telefono") ?? "")),
    lat: coordenadas?.lat ?? null,
    lng: coordenadas?.lng ?? null,
    horario: parseHorario(horarioDeDatos(datos)),
    abierta: datos.get("abierta") === "on",
    minutosAnticipacionRecojo: parseMinutos(String(datos.get("minutos") ?? "30")),
    aceptaDelivery: datos.get("aceptaDelivery") === "on",
    aceptaRecojo: datos.get("aceptaRecojo") === "on",
  };
}

async function exigirPersonal(
  slug: string,
  sucursalId: string | null,
  roles: readonly RolTienda[],
): Promise<Staff> {
  const normalizado = normalizarSlug(slug);
  if (!slugValido(normalizado) || slugReservado(normalizado)) throw new NoEncontrado();
  const service = createServiceClient();
  const { data, error } = await service.from("tiendas").select("id, slug").eq("slug", normalizado).maybeSingle();
  if (error) throw new Error(error.message);
  const tienda = data as { id: string; slug: string } | null;
  if (!tienda || tienda.slug !== normalizado) throw new NoEncontrado();
  return requireStaff({ tiendaId: tienda.id, sucursalId, roles });
}

async function sucursalesDe(staff: Staff): Promise<SucursalResumen[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select(CAMPOS_SUCURSAL)
    .eq("tienda_id", staff.tiendaId)
    .order("orden")
    .order("nombre");
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaSucursal[];
  if (staff.rol === "dueno") return filas.map(sucursalDesdeFila);
  const { data: asignadas, error: errorAsignadas } = await service
    .from("miembro_sucursales")
    .select("sucursal_id")
    .eq("miembro_id", staff.miembroId);
  if (errorAsignadas) throw new Error(errorAsignadas.message);
  const ids = new Set((asignadas ?? []).map((fila) => (fila as { sucursal_id: string }).sucursal_id));
  return filas.filter((fila) => ids.has(fila.id)).map(sucursalDesdeFila);
}

function visible(staff: Staff, sucursalId: string, sucursales: SucursalResumen[]): boolean {
  if (staff.rol === "dueno") return true;
  return sucursales.some((sucursal) => sucursal.id === sucursalId) && accesoSucursal(staff.rol, true);
}

async function sucursalDeTienda(tiendaId: string, sucursalId: string): Promise<SucursalResumen> {
  if (!esUuid(sucursalId)) throw new NegocioError("Esa sucursal no existe.");
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select(CAMPOS_SUCURSAL)
    .eq("id", sucursalId)
    .eq("tienda_id", tiendaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as FilaSucursal | null;
  if (!fila || fila.tienda_id !== tiendaId) throw new NegocioError("Esa sucursal no existe.");
  return sucursalDesdeFila(fila);
}

async function slugLibre(tiendaId: string, slug: string, excepto: string | null) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("id")
    .eq("tienda_id", tiendaId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as { id: string } | null;
  if (fila && fila.id !== excepto) throw new NegocioError("Ya hay una sucursal con ese identificador.");
}

async function sucursalesValidas(tiendaId: string, ids: string[], rol: RolTienda): Promise<string[]> {
  if (rol === "dueno") return [];
  if (ids.length === 0) throw new NegocioError("Asigna al menos una sucursal.");
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("id")
    .eq("tienda_id", tiendaId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const encontradas = new Set((data ?? []).map((fila) => (fila as { id: string }).id));
  if (ids.some((id) => !encontradas.has(id))) {
    throw new NegocioError("Una sucursal no pertenece a esta tienda.");
  }
  return ids;
}

async function reemplazarAsignaciones(miembroId: string, sucursalIds: string[]) {
  const service = createServiceClient();
  const { error: errorBorrar } = await service.from("miembro_sucursales").delete().eq("miembro_id", miembroId);
  if (errorBorrar) throw new Error(errorBorrar.message);
  if (sucursalIds.length === 0) return;
  const { error } = await service
    .from("miembro_sucursales")
    .insert(sucursalIds.map((sucursalId) => ({ miembro_id: miembroId, sucursal_id: sucursalId })));
  if (error) lanzarCupo(error.message);
}

async function exigirOtroDueno(tiendaId: string, miembroId: string) {
  const service = createServiceClient();
  const { count, error } = await service
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("tienda_id", tiendaId)
    .eq("rol", "dueno")
    .eq("activo", true)
    .neq("id", miembroId);
  if (error) throw new Error(error.message);
  if (!count) throw new NegocioError("La tienda tiene que conservar un dueño activo.");
}

async function asegurarUsuario(
  correo: string,
  origen: string | null,
): Promise<{ id: string; invitacion: "enviada" | "sin_correo" }> {
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
  if (typeof data === "string" && esUuid(data)) return { id: data, invitacion: "sin_correo" };
  console.error("invitar personal", invitado.error?.message ?? "sin usuario");
  throw new NegocioError("No se pudo invitar a esa persona. Revisa el correo e inténtalo de nuevo.");
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

function sucursalDesdeFila(fila: FilaSucursal): SucursalResumen {
  let horario = horarioPorDefecto();
  try {
    horario = parseHorario(fila.horario);
  } catch {
    horario = horarioPorDefecto();
  }
  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.nombre,
    direccion: fila.direccion,
    telefono: fila.telefono,
    lat: fila.lat,
    lng: fila.lng,
    horario,
    abierta: fila.abierta,
    minutosAnticipacionRecojo: fila.minutos_anticipacion_recojo,
    aceptaDelivery: fila.acepta_delivery,
    aceptaRecojo: fila.acepta_recojo,
    activa: fila.activa,
    orden: fila.orden,
  };
}

function validarAlta(input: AltaSucursal): AltaSucursal {
  const nombre = input.nombre.trim();
  if (nombre.length < 2) throw new NegocioError("Escribe el nombre de la sucursal.");
  return { ...input, nombre, slug: parseSlugSucursal(input.slug), horario: parseHorario(input.horario) };
}

function horarioDeDatos(datos: FormData): unknown {
  const horario: Record<string, { abierto: boolean; desde: string; hasta: string }> = {};
  for (const dia of ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]) {
    horario[dia] = {
      abierto: datos.get(`abierto-${dia}`) === "on",
      desde: String(datos.get(`desde-${dia}`) ?? ""),
      hasta: String(datos.get(`hasta-${dia}`) ?? ""),
    };
  }
  return horario;
}

function texto(valor: FormDataEntryValue | null, mensaje: string, max: number): string {
  const limpio = String(valor ?? "").trim();
  if (limpio.length < 2 || limpio.length > max) throw new NegocioError(mensaje);
  return limpio;
}

function textoOpcional(valor: FormDataEntryValue | null, max: number): string {
  const limpio = String(valor ?? "").trim();
  if (limpio.length > max) throw new NegocioError("La dirección es demasiado larga.");
  return limpio;
}

function lanzarCupo(mensaje: string): never {
  const cupo = mensaje.match(/Has alcanzado el máximo de .+ de tu plan/);
  if (cupo) throw new NegocioError(cupo[0]);
  if (mensaje.includes("no tiene sucursales habilitadas")) {
    throw new NegocioError("Esta tienda no tiene sucursales habilitadas.");
  }
  if (mensaje.includes("no pertenece a la tienda")) {
    throw new NegocioError("La sucursal no pertenece a la tienda del personal.");
  }
  throw new Error(mensaje);
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
