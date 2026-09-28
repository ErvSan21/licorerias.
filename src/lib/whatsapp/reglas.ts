import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import { NegocioError } from "@/lib/licencias/reglas";

export { NegocioError };

export const ventanaSaludoMs = 12 * 60 * 60 * 1000;

export type EstadoAviso = "pendiente" | "aceptado" | "listo" | "enviado" | "cancelado";

export type PedidoAviso = {
  id: string;
  estado: EstadoAviso;
  tipo: "delivery" | "recojo";
  total: number;
  tienda: string;
  sucursal: string;
  slug: string;
  horaRecojo: string | null;
  origen: string;
};

export type CredencialElegible = {
  sucursalId: string | null;
  activo: boolean;
};

export function mensajeEstado(pedido: PedidoAviso): string {
  const numero = pedido.id.slice(0, 4).toUpperCase();
  const cabeza = `🧾 ${pedido.tienda} · ${pedido.sucursal} · Pedido #${numero}`;
  if (pedido.estado === "pendiente") {
    const seguimiento = `${pedido.origen.replace(/\/$/, "")}/t/${pedido.slug}/pedido/${pedido.id}`;
    return `${cabeza}\n🛒 Pedido #${numero} recibido, total ${formatoBs(pedido.total)}\n${seguimiento}`;
  }
  if (pedido.estado === "aceptado") {
    return `${cabeza}\n✅ Tu pedido fue aceptado, ya lo estamos preparando`;
  }
  if (pedido.estado === "listo" && pedido.tipo === "recojo") {
    const hora = pedido.horaRecojo ? ` a las ${formatoFechaPrecio(pedido.horaRecojo)}` : "";
    return `${cabeza}\n📦 Tu pedido está listo, puedes pasar a recogerlo en ${pedido.sucursal}${hora}`;
  }
  if (pedido.estado === "listo") {
    return `${cabeza}\n🛵 Tu pedido está listo y saldrá a reparto en breve`;
  }
  if (pedido.estado === "enviado") {
    return `${cabeza}\n🚚 Tu pedido va en camino`;
  }
  return `${cabeza}\n❌ Tu pedido fue cancelado, escríbenos si tienes dudas`;
}

export function mensajeBienvenida(nombreTienda: string, link: string): string {
  return `👋 Hola, te damos la bienvenida a ${nombreTienda}. Mira la tienda y haz tu pedido: ${link}`;
}

export function enlacePedido(origen: string, slug: string, pedidoId: string): string {
  return `${origen.replace(/\/$/, "")}/t/${slug}/pedido/${pedidoId}`;
}

export function enlaceCatalogo(origen: string, slug: string, sucursalSlug: string | null, telefono: string): string {
  const base = origen.replace(/\/$/, "");
  const ruta = sucursalSlug ? `/t/${slug}/s/${sucursalSlug}` : `/t/${slug}`;
  return `${base}${ruta}?tel=${telefono}`;
}

export function enlaceWhatsapp(telefono: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, "")}`;
}

export function elegirCredencial<T extends CredencialElegible>(credenciales: readonly T[], sucursalId: string | null): T | null {
  const activas = credenciales.filter((credencial) => credencial.activo);
  if (sucursalId) {
    const propia = activas.find((credencial) => credencial.sucursalId === sucursalId);
    if (propia) return propia;
  }
  return activas.find((credencial) => credencial.sucursalId === null) ?? null;
}

export function debeSaludar(ultimoSaludo: Date | null, ahora: Date): boolean {
  if (!ultimoSaludo || Number.isNaN(ultimoSaludo.getTime())) return true;
  return ahora.getTime() - ultimoSaludo.getTime() > ventanaSaludoMs;
}

export function telefonoWebhook(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digitos)) return null;
  return digitos;
}

export type MensajeEntrante = { phoneNumberId: string; from: string };

export function mensajesWebhook(cuerpo: unknown): MensajeEntrante[] {
  if (!cuerpo || typeof cuerpo !== "object") return [];
  const entrada = (cuerpo as { entry?: unknown }).entry;
  if (!Array.isArray(entrada)) return [];
  const mensajes: MensajeEntrante[] = [];
  for (const item of entrada) {
    const changes = item && typeof item === "object" ? (item as { changes?: unknown }).changes : null;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change && typeof change === "object" ? (change as { value?: unknown }).value : null;
      if (!value || typeof value !== "object") continue;
      const meta = (value as { metadata?: { phone_number_id?: unknown }; messages?: unknown }).metadata;
      const phoneNumberId = typeof meta?.phone_number_id === "string" ? meta.phone_number_id.trim() : "";
      const crudos = (value as { messages?: unknown }).messages;
      if (!phoneNumberId || !Array.isArray(crudos)) continue;
      for (const mensaje of crudos) {
        const from = mensaje && typeof mensaje === "object" ? telefonoWebhook((mensaje as { from?: unknown }).from) : null;
        if (from) mensajes.push({ phoneNumberId, from });
      }
    }
  }
  return mensajes;
}

export function origenPublico(): string {
  const explicito = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicito) return explicito.replace(/\/$/, "");
  return "http://localhost:5000";
}

export function cifrarToken(token: string, clave: Buffer): string {
  if (clave.length !== 32) throw new NegocioError("La clave de cifrado de WhatsApp no es válida.");
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave, iv);
  const cifrado = Buffer.concat([cifrador.update(token, "utf8"), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return Buffer.concat([iv, etiqueta, cifrado]).toString("base64");
}

export function descifrarToken(cifrado: string, clave: Buffer): string {
  if (clave.length !== 32) throw new NegocioError("La clave de cifrado de WhatsApp no es válida.");
  const datos = Buffer.from(cifrado, "base64");
  if (datos.length < 29) throw new NegocioError("El token guardado no se puede leer.");
  const iv = datos.subarray(0, 12);
  const etiqueta = datos.subarray(12, 28);
  const cuerpo = datos.subarray(28);
  const descifrador = createDecipheriv("aes-256-gcm", clave, iv);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(cuerpo), descifrador.final()]).toString("utf8");
}

export function ultimosToken(token: string): string {
  const limpio = token.trim();
  return limpio.slice(-4);
}

export function parseIdentificadorMeta(valor: unknown, etiqueta: string): string {
  const texto = String(valor ?? "").trim();
  if (!/^\d{6,32}$/.test(texto)) throw new NegocioError(`Escribe el ${etiqueta}.`);
  return texto;
}

export function parseTokenNuevo(valor: unknown): string | null {
  if (valor == null || valor === "") return null;
  const texto = String(valor).trim();
  if (texto.length < 20 || texto.length > 400) throw new NegocioError("El token no parece válido.");
  if (/\s/.test(texto)) throw new NegocioError("El token no parece válido.");
  return texto;
}

export type VistaCredencial = {
  sucursalId: string | null;
  phoneNumberId: string;
  wabaId: string;
  tokenUltimos: string;
  activo: boolean;
};

export function vistaCredencial(fila: VistaCredencial & { tokenCifrado?: string }): VistaCredencial {
  return {
    sucursalId: fila.sucursalId,
    phoneNumberId: fila.phoneNumberId,
    wabaId: fila.wabaId,
    tokenUltimos: fila.tokenUltimos,
    activo: fila.activo,
  };
}
