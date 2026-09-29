import "server-only";

import type { ContextoPanel } from "@/lib/auth/panel";
import { esStockBajo } from "@/lib/inventario/reglas";
import { esPlazo, etiquetaPlazo, hoyBolivia, sumarDias } from "@/lib/licencias/reglas";
import { esEstadoPedido, referenciaPedido } from "@/lib/pedidos/reglas";
import { reporteDesdeJson, type Reporte } from "@/lib/reportes/reglas";
import { createServiceClient } from "@/lib/supabase/service";

import { inicialDia, variacionPorcentual, type DatosDashboard, type VentasDashboard } from "./dashboard";

// Bolivia no tiene horario de verano: siempre UTC-4.
const inicioDia = (fecha: string) => `${fecha}T00:00:00-04:00`;

/**
 * Datos del dashboard para las sucursales que el usuario ve.
 * El contexto ya verificó la membresía; aquí solo se filtra por tienda y sucursal.
 */
export async function leerDashboard(contexto: ContextoPanel): Promise<DatosDashboard> {
  const tiendaId = contexto.tienda.id;
  const sucursales = contexto.seleccion ? [contexto.seleccion] : contexto.sucursales.map((sucursal) => sucursal.id);
  if (sucursales.length === 0) {
    return { ventas: null, nuevos: 0, stockBajo: 0, licencia: null, ultimos: [] };
  }

  const service = createServiceClient();
  const hoy = hoyBolivia();
  const verVentas = contexto.staff.rol !== "vendedor";

  const [nuevosRes, stockRes, licenciaRes, ultimosRes, ventas] = await Promise.all([
    service
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("tienda_id", tiendaId)
      .in("sucursal_id", sucursales)
      .eq("estado", "pendiente"),
    service
      .from("producto_sucursal")
      .select("stock, stock_minimo, productos!inner(activo)")
      .eq("tienda_id", tiendaId)
      .in("sucursal_id", sucursales)
      .eq("disponible", true)
      .eq("productos.activo", true),
    service.from("licencias").select("plazo, vence").eq("tienda_id", tiendaId).maybeSingle(),
    service
      .from("pedidos")
      .select("id, cliente_nombre, tipo_entrega, total, estado")
      .eq("tienda_id", tiendaId)
      .in("sucursal_id", sucursales)
      .order("creado_en", { ascending: false })
      .limit(3),
    verVentas ? leerVentas(tiendaId, sucursales, hoy) : Promise.resolve(null),
  ]);

  for (const res of [nuevosRes, stockRes, licenciaRes, ultimosRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const stockBajo = ((stockRes.data ?? []) as { stock: number; stock_minimo: number }[]).filter((fila) =>
    esStockBajo(Number(fila.stock), Number(fila.stock_minimo)),
  ).length;

  const licenciaFila = licenciaRes.data as { plazo: string; vence: string | null } | null;
  const licencia =
    licenciaFila && esPlazo(licenciaFila.plazo)
      ? {
          plan: etiquetaPlazo(licenciaFila.plazo),
          dias: licenciaFila.vence ? diasHasta(hoy, licenciaFila.vence) : null,
        }
      : null;

  const ultimos = (
    (ultimosRes.data ?? []) as { id: string; cliente_nombre: string; tipo_entrega: string; total: number; estado: string }[]
  ).flatMap((fila) => {
    if (!esEstadoPedido(fila.estado)) return [];
    return [
      {
        id: referenciaPedido(fila.id),
        cliente: fila.cliente_nombre,
        tipo: fila.tipo_entrega === "recojo" ? ("recojo" as const) : ("delivery" as const),
        total: Number(fila.total),
        estado: fila.estado,
      },
    ];
  });

  return { ventas, nuevos: nuevosRes.count ?? 0, stockBajo, licencia, ultimos };
}

async function leerVentas(tiendaId: string, sucursales: string[], hoy: string): Promise<VentasDashboard> {
  const service = createServiceClient();
  const ayer = sumarDias(hoy, -1);
  const haceSeis = sumarDias(hoy, -6);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const ahora = new Date();
  const mismaHoraAyer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [diaHoy, semana, mes, ayerRes] = await Promise.all([
    reporte(tiendaId, sucursales, hoy, hoy),
    reporte(tiendaId, sucursales, haceSeis, hoy),
    reporte(tiendaId, sucursales, inicioMes, hoy),
    service
      .from("pedidos")
      .select("total")
      .eq("tienda_id", tiendaId)
      .in("sucursal_id", sucursales)
      .neq("estado", "cancelado")
      .gte("creado_en", inicioDia(ayer))
      .lt("creado_en", mismaHoraAyer),
  ]);
  if (ayerRes.error) throw new Error(ayerRes.error.message);
  const ventasAyer = ((ayerRes.data ?? []) as { total: number }[]).reduce((suma, fila) => suma + Number(fila.total), 0);

  // El reporte agrupa por día de la semana; en un rango de 7 días cada día aparece una vez.
  const dias = Array.from({ length: 7 }, (_, indice) => sumarDias(haceSeis, indice));
  const porDia = new Map(semana.dias.map((fila) => [fila.dia, fila.ventas]));

  return {
    ventasHoy: diaHoy.ventas,
    variacion: variacionPorcentual(diaHoy.ventas, ventasAyer),
    pedidosHoy: diaHoy.pedidos,
    ticket: diaHoy.ticket,
    semana: dias.map((fecha) => ({
      dia: inicialDia(fecha),
      ventas: porDia.get(new Date(`${fecha}T12:00:00Z`).getUTCDay()) ?? 0,
    })),
    masVendidos: [...mes.productos]
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 4)
      .map((fila) => ({ nombre: fila.nombre, unidades: fila.unidades })),
    porSucursal: [...mes.sucursales]
      .sort((a, b) => b.ventas - a.ventas)
      .map((fila) => ({ nombre: fila.nombre, ventas: fila.ventas })),
  };
}

async function reporte(tiendaId: string, sucursales: string[], desde: string, hasta: string): Promise<Reporte> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("reporte_tienda", {
    p_tienda: tiendaId,
    p_sucursales: sucursales,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw new Error(error.message);
  return reporteDesdeJson(data);
}

function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}
