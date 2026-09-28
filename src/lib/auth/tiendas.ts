import "server-only";

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
export async function tiendasDelUsuario(userId: string): Promise<TiendaDelUsuario[]> {
  const service = createServiceClient();
  const { data: miembros, error } = await service
    .from("miembros")
    .select("rol, tienda_id")
    .eq("user_id", userId)
    .eq("activo", true);

  if (error) throw new Error(error.message);

  const filas = (miembros ?? []) as FilaMiembro[];
  const ids = filas.map((fila) => fila.tienda_id);
  if (ids.length === 0) return [];

  const { data: tiendas, error: errorTiendas } = await service
    .from("tiendas")
    .select("id, slug, nombre, estado")
    .in("id", ids);

  if (errorTiendas) throw new Error(errorTiendas.message);

  const porId = new Map(
    ((tiendas ?? []) as FilaTienda[]).map((tienda) => [tienda.id, tienda]),
  );

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
}
