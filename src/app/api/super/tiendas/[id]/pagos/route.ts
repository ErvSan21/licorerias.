import { responderError } from "@/lib/licencias/http";
import { cabecerasPrivadas, registrarPago } from "@/lib/licencias/servicio";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json()) as {
      monto?: string | number;
      fecha?: string;
      metodo?: string;
      referencia?: string;
      periodoDesde?: string;
      periodoHasta?: string;
    };
    await registrarPago({
      tiendaId: id,
      monto: String(cuerpo.monto ?? ""),
      fecha: String(cuerpo.fecha ?? ""),
      metodo: String(cuerpo.metodo ?? ""),
      referencia: String(cuerpo.referencia ?? ""),
      periodoDesde: String(cuerpo.periodoDesde ?? ""),
      periodoHasta: String(cuerpo.periodoHasta ?? ""),
    });
    return Response.json({ ok: true }, { status: 201, headers: cabecerasPrivadas() });
  } catch (error) {
    return responderError(error);
  }
}
