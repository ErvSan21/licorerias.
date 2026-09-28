import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/** Un fallo de auditoría no debe impedir entrar o salir. */
export async function registrarAuditoria(input: {
  userId: string;
  tiendaId?: string | null;
  accion: string;
  detalle?: Record<string, unknown>;
}) {
  try {
    const service = createServiceClient();
    const { error } = await service.from("auditoria").insert({
      user_id: input.userId,
      tienda_id: input.tiendaId ?? null,
      accion: input.accion,
      detalle: input.detalle ?? {},
    });
    if (error) console.error("auditoria", error.message);
  } catch (error) {
    console.error("auditoria", error);
  }
}
