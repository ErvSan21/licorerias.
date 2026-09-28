import { cabecerasPrivadas, listarTiendas, tiendaParaApi, crearTienda } from "@/lib/licencias/servicio";
import { responderError } from "@/lib/licencias/http";
import { vencePronto, hoyBolivia } from "@/lib/licencias/reglas";

export async function GET(request: Request) {
  try {
    const vista = new URL(request.url).searchParams.get("vista");
    const hoy = hoyBolivia();
    const tiendas = await listarTiendas();
    const visibles =
      vista === "por-vencer"
        ? tiendas.filter(
            (tienda) =>
              tienda.estado === "activa" &&
              tienda.licencia &&
              (tienda.licencia.estado === "prueba" || tienda.licencia.estado === "activa") &&
              vencePronto(tienda.licencia.vence, hoy),
          )
        : tiendas;

    return Response.json(
      { tiendas: visibles.map(tiendaParaApi) },
      { headers: cabecerasPrivadas() },
    );
  } catch (error) {
    return responderError(error);
  }
}

export async function POST(request: Request) {
  try {
    const cuerpo = (await request.json()) as {
      nombre?: string;
      slug?: string;
      planId?: string;
      correoDueno?: string;
      diasPrueba?: number;
      diasGracia?: number;
    };
    const origen = request.headers.get("origin");
    const creada = await crearTienda(
      {
        nombre: String(cuerpo.nombre ?? ""),
        slug: String(cuerpo.slug ?? ""),
        planId: String(cuerpo.planId ?? ""),
        correoDueno: String(cuerpo.correoDueno ?? ""),
        diasPrueba: Number(cuerpo.diasPrueba ?? 14),
        diasGracia: Number(cuerpo.diasGracia ?? 3),
      },
      origen,
    );
    return Response.json(
      { id: creada.id, slug: creada.slug, invitacion: creada.invitacion },
      { status: 201, headers: cabecerasPrivadas() },
    );
  } catch (error) {
    return responderError(error);
  }
}
