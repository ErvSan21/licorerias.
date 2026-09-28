import { responderError } from "@/lib/licencias/http";
import {
  cabecerasPrivadas,
  cambiarPlan,
  extenderLicencia,
  leerTiendaSuper,
  reactivarLicencia,
  suspenderLicencia,
  tiendaParaApi,
} from "@/lib/licencias/servicio";
import { NegocioError } from "@/lib/licencias/reglas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detalle = await leerTiendaSuper(id);
    return Response.json(
      {
        tienda: tiendaParaApi(detalle.tienda),
        miembros: detalle.miembros.map((miembro) => ({
          rol: miembro.rol,
          activo: miembro.activo,
          correo: miembro.correo,
        })),
        pagos: detalle.pagos,
      },
      { headers: cabecerasPrivadas() },
    );
  } catch (error) {
    return responderError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json()) as {
      accion?: string;
      planId?: string;
      vence?: string;
    };

    if (cuerpo.accion === "cambiar_plan") {
      await cambiarPlan(id, String(cuerpo.planId ?? ""));
    } else if (cuerpo.accion === "extender") {
      await extenderLicencia(id, String(cuerpo.vence ?? ""));
    } else if (cuerpo.accion === "suspender") {
      await suspenderLicencia(id);
    } else if (cuerpo.accion === "reactivar") {
      await reactivarLicencia(id);
    } else {
      throw new NegocioError("Acción no reconocida.");
    }

    return Response.json({ ok: true }, { headers: cabecerasPrivadas() });
  } catch (error) {
    return responderError(error);
  }
}
