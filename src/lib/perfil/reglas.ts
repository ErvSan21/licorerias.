import { NegocioError } from "@/lib/licencias/reglas";
import { normalizarTelefono } from "@/lib/pedidos/reglas";
import { capitalizar } from "@/lib/texto";

/** Datos personales del usuario. Se guardan en user_metadata de Supabase Auth. */
export type Perfil = {
  nombre: string;
  apellido: string;
  celular: string | null;
};

export function perfilDesdeMetadata(metadata: unknown): Perfil {
  const datos = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
  return {
    nombre: texto(datos.nombre),
    apellido: texto(datos.apellido),
    celular: texto(datos.celular) || null,
  };
}

/** "Ana Pérez"; si no hay nombre, el correo. */
export function nombreVisible(perfil: Perfil, correo: string | null): string {
  const completo = `${perfil.nombre} ${perfil.apellido}`.trim();
  return completo || correo || "Sin nombre";
}

export function parsePerfil(input: { nombre?: unknown; apellido?: unknown; celular?: unknown }): Perfil {
  const nombre = String(input.nombre ?? "").trim();
  const apellido = String(input.apellido ?? "").trim();
  if (nombre.length < 2 || nombre.length > 60) throw new NegocioError("Escribe el nombre.");
  if (apellido.length < 2 || apellido.length > 60) throw new NegocioError("Escribe el apellido.");
  const celular = String(input.celular ?? "").trim();
  return {
    nombre: capitalizar(nombre),
    apellido: capitalizar(apellido),
    celular: celular ? normalizarTelefono(celular) : null,
  };
}
