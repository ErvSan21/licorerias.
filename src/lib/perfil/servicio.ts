import "server-only";

import { AccesoError } from "@/lib/auth/errors";
import { usuarioVerificado } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/service";

import { nombreVisible, parsePerfil, perfilDesdeMetadata, type Perfil } from "./reglas";

/** Guarda nombre, apellido y celular del usuario con sesión. El correo no cambia aquí. */
export async function guardarMiPerfil(input: { nombre: unknown; apellido: unknown; celular: unknown }): Promise<Perfil> {
  const usuario = await usuarioVerificado();
  if (!usuario) throw new AccesoError("no_autenticado");
  const perfil = parsePerfil(input);
  await guardarPerfil(usuario.id, perfil);
  return perfil;
}

export async function guardarPerfil(userId: string, perfil: Perfil): Promise<void> {
  const service = createServiceClient();
  const { data, error: errorLeer } = await service.auth.admin.getUserById(userId);
  if (errorLeer) throw new Error(errorLeer.message);
  const { error } = await service.auth.admin.updateUserById(userId, {
    user_metadata: { ...(data.user?.user_metadata ?? {}), ...perfil },
  });
  if (error) throw new Error(error.message);
}

/** Nombre visible ("Ana Pérez" o el correo) de varios usuarios, por id. */
export async function nombresDeUsuarios(ids: string[]): Promise<Map<string, string>> {
  const service = createServiceClient();
  const unicos = [...new Set(ids)];
  const pares = await Promise.all(
    unicos.map(async (id) => {
      const { data, error } = await service.auth.admin.getUserById(id);
      if (error || !data.user) return null;
      return [id, nombreVisible(perfilDesdeMetadata(data.user.user_metadata), data.user.email ?? null)] as const;
    }),
  );
  return new Map(pares.filter((par): par is readonly [string, string] => par !== null));
}
