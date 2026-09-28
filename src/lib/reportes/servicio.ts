import "server-only";

import { NoEncontrado } from "@/lib/auth/errors";
import { resolveTenantBySlug } from "@/lib/auth/panel";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/service";

import { parseRango, reporteDesdeJson, reporteVacio, sucursalesDelReporte, type Reporte } from "./reglas";

export async function leerReporte(
  slug: string,
  sucursalesVisibles: readonly string[],
  consulta: { desde?: unknown; hasta?: unknown; sucursal?: unknown },
): Promise<{ reporte: Reporte; desde: string; hasta: string; sucursal: string }> {
  const tienda = await resolveTenantBySlug(slug);
  if (!tienda) throw new NoEncontrado();
  await requireStaff({ tiendaId: tienda.id, sucursalId: null, roles: ["dueno", "gerente"] });
  const rango = parseRango(consulta.desde, consulta.hasta);
  const sucursales = sucursalesDelReporte(sucursalesVisibles, consulta.sucursal);
  if (sucursales.length === 0) {
    return { reporte: reporteVacio(), ...rango, sucursal: "" };
  }
  const service = createServiceClient();
  const { data, error } = await service.rpc("reporte_tienda", {
    p_tienda: tienda.id,
    p_sucursales: sucursales,
    p_desde: rango.desde,
    p_hasta: rango.hasta,
  });
  if (error) throw new Error(error.message);
  const pedida = typeof consulta.sucursal === "string" ? consulta.sucursal : "";
  return { reporte: reporteDesdeJson(data), ...rango, sucursal: sucursales.length === 1 && pedida ? pedida : "" };
}
