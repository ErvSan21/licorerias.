import "server-only";

import { cache } from "react";

import { AccesoError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accesoSucursal } from "@/lib/sucursales/reglas";
import { esRolTienda, type RolTienda } from "@/lib/tenant";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Staff = {
  userId: string;
  miembroId: string;
  rol: RolTienda;
  tiendaId: string;
  sucursalId: string | null;
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
 * Verifica el token de Auth, la membresía y, si viene sucursalId, el acceso a esa sucursal.
 * tiendaId y sucursalId tienen que salir del servidor, nunca del navegador sin esta comprobación.
 */
export async function requireStaff(input: {
  tiendaId: string;
  sucursalId: string | null;
  roles: readonly RolTienda[];
}): Promise<Staff> {
  if (!UUID.test(input.tiendaId) || input.roles.length === 0) {
    throw new AccesoError("prohibido");
  }
  if (input.sucursalId !== null && !UUID.test(input.sucursalId)) {
    throw new AccesoError("prohibido");
  }
  for (const rol of input.roles) {
    if (!esRolTienda(rol)) throw new AccesoError("prohibido");
  }

  const user = await usuarioVerificado();
  if (!user) throw new AccesoError("no_autenticado");

  const service = createServiceClient();
  const fila = await miembroActivo(user.id, input.tiendaId);
  if (!fila || fila.user_id !== user.id || fila.tienda_id !== input.tiendaId || !fila.activo) {
    throw new AccesoError("prohibido");
  }
  if (!esRolTienda(fila.rol) || !input.roles.includes(fila.rol)) {
    throw new AccesoError("prohibido");
  }

  if (input.sucursalId) {
    const { data: sucursal, error: errorSucursal } = await service
      .from("sucursales")
      .select("id, tienda_id")
      .eq("id", input.sucursalId)
      .eq("tienda_id", input.tiendaId)
      .maybeSingle();
    if (errorSucursal) throw new Error(errorSucursal.message);
    const filaSucursal = sucursal as { id: string; tienda_id: string } | null;
    if (!filaSucursal || filaSucursal.tienda_id !== input.tiendaId) {
      throw new AccesoError("prohibido");
    }

    const { data: asignacion, error: errorAsignacion } = await service
      .from("miembro_sucursales")
      .select("sucursal_id")
      .eq("miembro_id", fila.id)
      .eq("sucursal_id", input.sucursalId)
      .maybeSingle();
    if (errorAsignacion) throw new Error(errorAsignacion.message);
    if (!accesoSucursal(fila.rol, Boolean(asignacion))) {
      throw new AccesoError("prohibido");
    }
  }

  return {
    userId: user.id,
    miembroId: fila.id,
    rol: fila.rol,
    tiendaId: fila.tienda_id,
    sucursalId: input.sucursalId,
  };
}

const miembroActivo = cache(async (userId: string, tiendaId: string): Promise<FilaMiembro | null> => {
  const service = createServiceClient();
  const { data, error } = await service
    .from("miembros")
    .select("id, rol, activo, user_id, tienda_id")
    .eq("user_id", userId)
    .eq("tienda_id", tiendaId)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as FilaMiembro | null;
});

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
