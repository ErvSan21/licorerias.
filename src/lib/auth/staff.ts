import "server-only";

import { cache } from "react";

import { AccesoError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { esRolTienda, type RolTienda } from "@/lib/tenant";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Staff = {
  userId: string;
  miembroId: string;
  rol: RolTienda;
  tiendaId: string;
  sucursalId: null;
};

type FilaMiembro = {
  id: string;
  rol: string;
  activo: boolean;
  user_id: string;
  tienda_id: string;
};

export const usuarioVerificado = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * Verifica el token de Auth y la membresía en la base.
 * tiendaId tiene que salir del servidor (slug resuelto), nunca del navegador.
 * sucursalId forma parte del contrato; el acceso por sucursal es el Módulo 2.
 */
export async function requireStaff(input: {
  tiendaId: string;
  sucursalId: string | null;
  roles: readonly RolTienda[];
}): Promise<Staff> {
  if (input.sucursalId) {
    throw new AccesoError("prohibido");
  }
  if (!UUID.test(input.tiendaId) || input.roles.length === 0) {
    throw new AccesoError("prohibido");
  }
  for (const rol of input.roles) {
    if (!esRolTienda(rol)) throw new AccesoError("prohibido");
  }

  const user = await usuarioVerificado();
  if (!user) throw new AccesoError("no_autenticado");

  const service = createServiceClient();
  const { data, error } = await service
    .from("miembros")
    .select("id, rol, activo, user_id, tienda_id")
    .eq("user_id", user.id)
    .eq("tienda_id", input.tiendaId)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const fila = data as FilaMiembro | null;
  if (!fila || fila.user_id !== user.id || fila.tienda_id !== input.tiendaId || !fila.activo) {
    throw new AccesoError("prohibido");
  }
  if (!esRolTienda(fila.rol) || !input.roles.includes(fila.rol)) {
    throw new AccesoError("prohibido");
  }

  return {
    userId: user.id,
    miembroId: fila.id,
    rol: fila.rol,
    tiendaId: fila.tienda_id,
    sucursalId: null,
  };
}

export const usuarioEsSuperAdmin = cache(async (userId: string) => {
  const service = createServiceClient();
  const { data, error } = await service
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const fila = data as { user_id: string } | null;
  return Boolean(fila && fila.user_id === userId);
});

export const requireSuperAdmin = cache(async (): Promise<{ userId: string }> => {
  const user = await usuarioVerificado();
  if (!user) throw new AccesoError("no_autenticado");

  const service = createServiceClient();
  const { data, error } = await service
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const fila = data as { user_id: string } | null;
  if (!fila || fila.user_id !== user.id) throw new AccesoError("prohibido");
  return { userId: user.id };
});
