import {
  ajustarPrecioCentralCategoria,
  ajustarPreciosPropios,
  copiarPreciosPropios,
  guardarConfiguracionPrecios,
  guardarPrecioSucursal,
  volverPreciosCentrales,
} from "@/lib/catalogo/servicio";
import { NegocioError, parseMargen, parsePorcentaje, parsePrecio } from "@/lib/catalogo/reglas";
import { jsonPrivado, responderCatalogo } from "@/lib/catalogo/http";

type Cuerpo = {
  accion?: string;
  productoId?: string;
  sucursalId?: string;
  origenId?: string;
  destinoId?: string;
  categoriaId?: string;
  precio?: unknown;
  porcentaje?: unknown;
  usaPrecioCentral?: boolean;
  permiten?: boolean;
  margen?: unknown;
};

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const cuerpo = (await request.json()) as Cuerpo;
    const total = await ejecutar(slug, cuerpo);
    return jsonPrivado({ ok: true, total });
  } catch (error) {
    return responderCatalogo(error);
  }
}

async function ejecutar(slug: string, cuerpo: Cuerpo): Promise<number | null> {
  if (cuerpo.accion === "sucursal") {
    await guardarPrecioSucursal(
      slug,
      String(cuerpo.productoId ?? ""),
      String(cuerpo.sucursalId ?? ""),
      Boolean(cuerpo.usaPrecioCentral),
      cuerpo.usaPrecioCentral ? null : parsePrecio(cuerpo.precio),
    );
    return null;
  }
  if (cuerpo.accion === "volver-central") {
    return volverPreciosCentrales(slug, String(cuerpo.sucursalId ?? ""));
  }
  if (cuerpo.accion === "ajuste-central") {
    return ajustarPrecioCentralCategoria(slug, String(cuerpo.categoriaId ?? ""), parsePorcentaje(cuerpo.porcentaje));
  }
  if (cuerpo.accion === "ajuste-propio") {
    return ajustarPreciosPropios(slug, String(cuerpo.sucursalId ?? ""), parsePorcentaje(cuerpo.porcentaje));
  }
  if (cuerpo.accion === "copiar") {
    return copiarPreciosPropios(slug, String(cuerpo.origenId ?? ""), String(cuerpo.destinoId ?? ""));
  }
  if (cuerpo.accion === "configuracion") {
    await guardarConfiguracionPrecios(slug, Boolean(cuerpo.permiten), parseMargen(cuerpo.margen));
    return null;
  }
  throw new NegocioError("Acción de precio desconocida.");
}
