import "server-only";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { NegocioError } from "@/lib/licencias/reglas";
import { exigirLicenciaParaEscribir } from "@/lib/licencias/servicio";
import { createServiceClient } from "@/lib/supabase/service";

export type AjustesSucursales = {
  /** true: cada sucursal puede fijar su precio. */
  permitenPrecioPropio: boolean;
  margenMax: number | null;
  /** true: las sucursales ofrecen siempre el catálogo de la central. */
  catalogoCentral: boolean;
  /** Si la tienda puede tener más de una sucursal. */
  sucursalesHabilitadas: boolean;
};

export async function leerAjustesSucursales(slug: string): Promise<AjustesSucursales> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno", "gerente", "vendedor"] });
  const service = createServiceClient();
  const [precios, catalogo, tiendaRes] = await Promise.all([
    service
      .from("configuracion_tienda")
      .select("sucursales_pueden_fijar_precio, margen_max_porcentaje")
      .eq("tienda_id", tienda.id)
      .maybeSingle(),
    service.from("configuracion_tienda").select("catalogo_central").eq("tienda_id", tienda.id).maybeSingle(),
    service.from("tiendas").select("sucursales_habilitadas").eq("id", tienda.id).maybeSingle(),
  ]);
  if (precios.error) throw new Error(precios.error.message);
  const fila = precios.data as { sucursales_pueden_fijar_precio: boolean; margen_max_porcentaje: number | string | null } | null;
  // Sin la migración de catálogo central, la columna no existe: se toma como desactivado.
  const central = catalogo.error ? null : (catalogo.data as { catalogo_central: boolean } | null);
  const habilitadas = tiendaRes.error ? null : (tiendaRes.data as { sucursales_habilitadas: boolean } | null);
  return {
    permitenPrecioPropio: fila?.sucursales_pueden_fijar_precio ?? true,
    margenMax: fila?.margen_max_porcentaje == null ? null : Number(fila.margen_max_porcentaje),
    catalogoCentral: central?.catalogo_central ?? false,
    sucursalesHabilitadas: habilitadas?.sucursales_habilitadas ?? true,
  };
}

/** Activa o desactiva el catálogo de la central en todas las sucursales. Solo el dueño. */
export async function guardarCatalogoCentral(slug: string, activo: boolean): Promise<void> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  const staff = await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno"] });
  await exigirLicenciaParaEscribir(tienda.id);
  const service = createServiceClient();
  // Al pasar a true, un trigger de la base copia el catálogo de la central a las sucursales.
  const { error } = await service
    .from("configuracion_tienda")
    .update({ catalogo_central: activo })
    .eq("tienda_id", tienda.id);
  if (error) {
    if (error.message.includes("catalogo_central")) {
      throw new NegocioError("Falta aplicar la migración del catálogo central en la base de datos.");
    }
    throw new Error(error.message);
  }
  await registrarAuditoria({
    userId: staff.userId,
    tiendaId: tienda.id,
    accion: "sucursales.catalogo_central",
    detalle: { activo },
  });
}
