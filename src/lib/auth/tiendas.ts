import "server-only";

import { cache } from "react";

import { createServiceClient } from "@/lib/supabase/service";
import {
  esEstadoTienda,
  esRolTienda,
  type EstadoTienda,
  type RolTienda,
} from "@/lib/tenant";

export type TiendaDelUsuario = {
  id: string;
  slug: string;
  nombre: string;
  estado: EstadoTienda;
  rol: RolTienda;
};

type FilaMiembro = { rol: string; tienda_id: string };
type FilaTienda = {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
};

/** Lista las tiendas del usuario ya verificado. No lee un tienda_id del navegador. */
export const tiendasDelUsuario = cache(async (userId: string): Promise<TiendaDelUsuario[]> => {
  const service = createServiceClient();
  const { data: miembros, error } = await service
    .from("miembros")
    .select("rol, tienda_id, tiendas!inner(id, slug, nombre, estado)")
    .eq("user_id", userId)
    .eq("activo", true);

  if (error) throw new Error(error.message);

  const filas = (miembros ?? []) as unknown as (FilaMiembro & { tiendas: FilaTienda | FilaTienda[] | null })[];
  if (filas.length === 0) return [];

  const porId = new Map<string, FilaTienda>();
  for (const fila of filas) {
    const tienda = Array.isArray(fila.tiendas) ? fila.tiendas[0] : fila.tiendas;
    if (tienda) porId.set(fila.tienda_id, tienda);
  }

  const resultado: TiendaDelUsuario[] = [];
  for (const fila of filas) {
    const tienda = porId.get(fila.tienda_id);
    if (!tienda || !esRolTienda(fila.rol) || !esEstadoTienda(tienda.estado)) continue;
    resultado.push({
      id: tienda.id,
      slug: tienda.slug,
      nombre: tienda.nombre,
      estado: tienda.estado,
      rol: fila.rol,
    });
  }

  return resultado.toSorted((a, b) => a.nombre.localeCompare(b.nombre, "es"));
});
