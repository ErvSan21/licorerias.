import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { normalizarTelefono } from "@/lib/pedidos/reglas";
import { createServiceClient } from "@/lib/supabase/service";

import {
  cifrarToken,
  descifrarToken,
  debeSaludar,
  elegirCredencial,
  enlaceCatalogo,
  mensajeBienvenida,
  mensajeEstado,
  mensajesWebhook,
  NegocioError,
  origenPublico,
  parseIdentificadorMeta,
  parseTokenNuevo,
  ultimosToken,
  vistaCredencial,
  type EstadoAviso,
  type PedidoAviso,
  type VistaCredencial,
} from "./whatsapp/reglas";

export { mensajeEstado, enlaceWhatsapp } from "./whatsapp/reglas";

type FilaCredencial = {
  id: string;
  tienda_id: string;
  sucursal_id: string | null;
  phone_number_id: string;
  waba_id: string;
  token_cifrado: string;
  token_ultimos: string;
  activo: boolean;
};

export async function listarCredenciales(slug: string): Promise<VistaCredencial[]> {
  const tienda = await tiendaDueno(slug);
  const service = createServiceClient();
  const { data, error } = await service
    .from("credenciales_whatsapp")
    .select("sucursal_id, phone_number_id, waba_id, token_ultimos, activo")
    .eq("tienda_id", tienda.id);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Omit<FilaCredencial, "id" | "tienda_id" | "token_cifrado">[]).map((fila) =>
    vistaCredencial({
      sucursalId: fila.sucursal_id,
      phoneNumberId: fila.phone_number_id,
      wabaId: fila.waba_id,
      tokenUltimos: fila.token_ultimos,
      activo: fila.activo,
    }),
  );
}

export async function guardarCredencial(
  slug: string,
  input: {
    sucursalId: string | null;
    phoneNumberId: string;
    wabaId: string;
    token: string | null;
    activo: boolean;
  },
): Promise<void> {
  const phoneNumberId = parseIdentificadorMeta(input.phoneNumberId, "identificador del número");
  const wabaId = parseIdentificadorMeta(input.wabaId, "identificador de la cuenta");
  const tokenNuevo = parseTokenNuevo(input.token);
  const { tienda, staff } = await exigirDueno(slug, input.sucursalId);
  const service = createServiceClient();
  const existente = await filaCredencial(tienda.id, input.sucursalId);
  if (!tokenNuevo && !existente) throw new NegocioError("Escribe el token de WhatsApp.");
  const tokenCifrado = tokenNuevo ? cifrarToken(tokenNuevo, claveWhatsapp()) : existente!.token_cifrado;
  const tokenUltimos = tokenNuevo ? ultimosToken(tokenNuevo) : existente!.token_ultimos;
  if (existente) {
    const { error } = await service
      .from("credenciales_whatsapp")
      .update({
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        token_cifrado: tokenCifrado,
        token_ultimos: tokenUltimos,
        activo: input.activo,
      })
      .eq("id", existente.id)
      .eq("tienda_id", tienda.id);
    if (error) lanzar(error.message);
  } else {
    const { error } = await service.from("credenciales_whatsapp").insert({
      tienda_id: tienda.id,
      sucursal_id: input.sucursalId,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      token_cifrado: tokenCifrado,
      token_ultimos: tokenUltimos,
      activo: input.activo,
    });
    if (error) lanzar(error.message);
  }
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "whatsapp.credenciales",
    detalle: { sucursal_id: input.sucursalId, phone_number_id: phoneNumberId, activo: input.activo },
  });
}

export async function enviarPrueba(slug: string, sucursalId: string | null, telefono: string): Promise<void> {
  const destino = normalizarTelefono(telefono);
  const { tienda, staff } = await exigirDueno(slug, sucursalId);
  await enviarTexto(tienda.id, sucursalId, destino, `Mensaje de prueba de ${tienda.nombre}.`);
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "whatsapp.prueba",
    detalle: { sucursal_id: sucursalId },
  });
}

export async function enviarTexto(tiendaId: string, sucursalId: string | null, to: string, body: string): Promise<void> {
  const credencial = await resolverCredencial(tiendaId, sucursalId);
  if (!credencial) throw new NegocioError("Esta tienda no tiene WhatsApp configurado.");
  const token = descifrarToken(credencial.token_cifrado, claveWhatsapp());
  const respuesta = await fetch(`https://graph.facebook.com/v21.0/${credencial.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!respuesta.ok) throw new NegocioError("WhatsApp no aceptó el mensaje.");
}

export async function avisarPedido(pedidoId: string, estado: string): Promise<boolean> {
  if (!esEstadoAviso(estado)) return false;
  const service = createServiceClient();
  const { data, error } = await service
    .from("pedidos")
    .select("id, tienda_id, sucursal_id, telefono, tipo_entrega, total, hora_recojo, estado")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error || !data) return false;
  const fila = data as {
    id: string;
    tienda_id: string;
    sucursal_id: string;
    telefono: string;
    tipo_entrega: string;
    total: number | string;
    hora_recojo: string | null;
    estado: string;
  };
  const { data: tienda, error: errorTienda } = await service
    .from("tiendas")
    .select("nombre, slug")
    .eq("id", fila.tienda_id)
    .maybeSingle();
  if (errorTienda || !tienda) return false;
  const { data: sucursal, error: errorSucursal } = await service
    .from("sucursales")
    .select("nombre")
    .eq("id", fila.sucursal_id)
    .maybeSingle();
  if (errorSucursal || !sucursal) return false;
  const nombres = tienda as { nombre: string; slug: string };
  const pedido: PedidoAviso = {
    id: fila.id,
    estado,
    tipo: fila.tipo_entrega === "delivery" ? "delivery" : "recojo",
    total: Number(fila.total),
    tienda: nombres.nombre,
    sucursal: (sucursal as { nombre: string }).nombre,
    slug: nombres.slug,
    horaRecojo: fila.hora_recojo,
    origen: origenPublico(),
  };
  await enviarTexto(fila.tienda_id, fila.sucursal_id, fila.telefono, mensajeEstado(pedido));
  return true;
}

export async function procesarWebhook(cuerpo: unknown): Promise<void> {
  for (const mensaje of mensajesWebhook(cuerpo)) {
    try {
      await saludar(mensaje.phoneNumberId, mensaje.from);
    } catch {
      // Un fallo de WhatsApp no cambia la respuesta del webhook.
    }
  }
}

async function saludar(phoneNumberId: string, from: string): Promise<void> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("credenciales_whatsapp")
    .select("id, tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos, activo")
    .eq("phone_number_id", phoneNumberId)
    .eq("activo", true)
    .maybeSingle();
  if (error || !data) return;
  const credencial = data as FilaCredencial;
  const { data: tienda, error: errorTienda } = await service
    .from("tiendas")
    .select("nombre, slug")
    .eq("id", credencial.tienda_id)
    .maybeSingle();
  if (errorTienda || !tienda) return;
  const nombres = tienda as { nombre: string; slug: string };
  let sucursalSlug: string | null = null;
  if (credencial.sucursal_id) {
    const { data: sucursal } = await service.from("sucursales").select("slug").eq("id", credencial.sucursal_id).maybeSingle();
    sucursalSlug = (sucursal as { slug: string } | null)?.slug ?? null;
  }
  const { data: previa } = await service
    .from("conversaciones")
    .select("ultimo_saludo")
    .eq("tienda_id", credencial.tienda_id)
    .eq("telefono", from)
    .maybeSingle();
  const ultimo = (previa as { ultimo_saludo: string } | null)?.ultimo_saludo ?? null;
  if (!debeSaludar(ultimo ? new Date(ultimo) : null, new Date())) return;
  const link = enlaceCatalogo(origenPublico(), nombres.slug, sucursalSlug, from);
  await enviarTexto(credencial.tienda_id, credencial.sucursal_id, from, mensajeBienvenida(nombres.nombre, link));
  await service.from("conversaciones").upsert(
    { tienda_id: credencial.tienda_id, telefono: from, ultimo_saludo: new Date().toISOString() },
    { onConflict: "tienda_id,telefono" },
  );
}

async function resolverCredencial(tiendaId: string, sucursalId: string | null): Promise<FilaCredencial | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("credenciales_whatsapp")
    .select("id, tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos, activo")
    .eq("tienda_id", tiendaId);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaCredencial[];
  const elegida = elegirCredencial(
    filas.map((fila) => ({ ...fila, sucursalId: fila.sucursal_id, activo: fila.activo })),
    sucursalId,
  );
  return elegida;
}

function claveWhatsapp(): Buffer {
  const cruda = process.env.WHATSAPP_CLAVE?.trim();
  if (!cruda) throw new NegocioError("Falta la clave de cifrado de WhatsApp en el servidor.");
  const bytes = Buffer.from(cruda, "base64");
  if (bytes.length !== 32) throw new NegocioError("La clave de cifrado de WhatsApp no es válida.");
  return bytes;
}

async function tiendaDueno(slug: string) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  return tienda;
}

async function exigirDueno(slug: string, sucursalId: string | null) {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({
    tiendaId: tienda.id,
    sucursalId,
    roles: ["dueno"],
  });
  await exigirLicenciaParaEscribir(tienda.id);
  if (sucursalId) {
    const service = createServiceClient();
    const { data, error } = await service
      .from("sucursales")
      .select("id")
      .eq("id", sucursalId)
      .eq("tienda_id", tienda.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NegocioError("La sucursal no pertenece a la tienda.");
  }
  return { tienda, staff };
}

async function filaCredencial(tiendaId: string, sucursalId: string | null): Promise<FilaCredencial | null> {
  const service = createServiceClient();
  let consulta = service
    .from("credenciales_whatsapp")
    .select("id, tienda_id, sucursal_id, phone_number_id, waba_id, token_cifrado, token_ultimos, activo")
    .eq("tienda_id", tiendaId);
  consulta = sucursalId ? consulta.eq("sucursal_id", sucursalId) : consulta.is("sucursal_id", null);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaCredencial | null) ?? null;
}

function esEstadoAviso(estado: string): estado is EstadoAviso {
  return estado === "pendiente" || estado === "aceptado" || estado === "listo" || estado === "enviado" || estado === "cancelado";
}

function lanzar(mensaje: string): never {
  if (mensaje.includes("credenciales_phone") || mensaje.includes("phone_number_id")) {
    throw new NegocioError("Ese número de WhatsApp ya está registrado.");
  }
  throw new Error(mensaje);
}
