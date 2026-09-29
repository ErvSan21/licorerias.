import "server-only";

import { cache } from "react";

import { NoEncontrado } from "@/lib/auth/errors";
import { requireStaff, usuarioVerificado, type Staff } from "@/lib/auth/staff";
import { licenciaVigente } from "@/lib/licencias/servicio";
import { leerSeleccion } from "@/lib/sucursales/seleccion";
import { listarSucursalesVisibles, type SucursalResumen } from "@/lib/sucursales/servicio";
import { createServiceClient } from "@/lib/supabase/service";
import { tiendasDelUsuario, type TiendaDelUsuario } from "@/lib/auth/tiendas";
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

/** Una sola consulta por request aunque la pidan el layout, la página y los servicios. */
export const resolveTenantBySlug = cache(async (slug: string): Promise<TiendaResuelta | null> => {
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
});

export const cargarPanel = cache(async (slugCrudo: string) => {
  const slug = normalizarSlug(slugCrudo);
  if (!slugValido(slug) || slugReservado(slug)) throw new NoEncontrado();

  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();

  const [staff, vigente] = await Promise.all([
    requireStaff({
      tiendaId: tienda.id,
      sucursalId: null,
      roles: ROLES_TIENDA,
    }),
    licenciaVigente(tienda.id),
  ]);

  return { tienda, staff: staff as Staff, vigente };
});

export const contextoPanel = cache(async (slugCrudo: string) => {
  // Las tiendas del usuario solo dependen de su sesión: se piden junto con la membresía.
  const user = await usuarioVerificado();
  const tiendasPedidas = user ? tiendasDelUsuario(user.id) : null;
  tiendasPedidas?.catch(() => null);
  const base = await cargarPanel(slugCrudo);
  const [{ sucursales }, tiendas] = await Promise.all([
    listarSucursalesVisibles(base.tienda.slug),
    tiendasPedidas ?? tiendasDelUsuario(base.staff.userId),
  ]);
  const seleccion = await leerSeleccion(base.staff, sucursales);
  return { ...base, sucursales, tiendas, seleccion };
});

export type ContextoPanel = {
  tienda: TiendaResuelta;
  staff: Staff;
  vigente: boolean;
  sucursales: SucursalResumen[];
  tiendas: TiendaDelUsuario[];
  seleccion: string | null;
};
