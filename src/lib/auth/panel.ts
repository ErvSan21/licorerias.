import "server-only";

import { cache } from "react";

import { NoEncontrado } from "@/lib/auth/errors";
import { requireStaff, type Staff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/service";
import {
  esEstadoTienda,
  normalizarSlug,
  ROLES_TIENDA,
  slugReservado,
  slugValido,
  type EstadoTienda,
} from "@/lib/tenant";

export type TiendaResuelta = {
  id: string;
  slug: string;
  nombre: string;
  estado: EstadoTienda;
};

type FilaTienda = {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
};

export async function resolveTenantBySlug(slug: string): Promise<TiendaResuelta | null> {
  const normalizado = normalizarSlug(slug);
  if (!slugValido(normalizado) || slugReservado(normalizado)) return null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("tiendas")
    .select("id, slug, nombre, estado")
    .eq("slug", normalizado)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const fila = data as FilaTienda | null;
  if (!fila || fila.slug !== normalizado || !esEstadoTienda(fila.estado)) return null;

  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.nombre,
    estado: fila.estado,
  };
}

export const cargarPanel = cache(async (slugCrudo: string) => {
  const slug = normalizarSlug(slugCrudo);
  if (!slugValido(slug) || slugReservado(slug)) throw new NoEncontrado();

  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();

  const staff: Staff = await requireStaff({
    tiendaId: tienda.id,
    sucursalId: null,
    roles: ROLES_TIENDA,
  });

  return { tienda, staff };
});
