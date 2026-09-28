import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { archivoMarca, guardarMarca, leerMarcaDueno } from "@/lib/marca/servicio";
import { NegocioError } from "@/lib/licencias/reglas";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const marca = await leerMarcaDueno(slug);
    return Response.json({ marca }, { headers: PRIVADO });
  } catch (error) {
    return responder(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.formData();
    const marca = await guardarMarca(
      slug,
      {
        nombreComercial: datos.get("nombreComercial"),
        colorPrimario: datos.get("colorPrimario"),
        mensajeBienvenida: datos.get("mensajeBienvenida"),
        quitarLogo: datos.get("quitarLogo") === "1",
        quitarBanner: datos.get("quitarBanner") === "1",
      },
      {
        logo: await archivoMarca(datos, "logo"),
        banner: await archivoMarca(datos, "banner"),
      },
    );
    return Response.json({ marca }, { headers: PRIVADO });
  } catch (error) {
    if (error instanceof NegocioError) return responderError(error);
    return responder(error);
  }
}

function responder(error: unknown): Response {
  if (error instanceof NoEncontrado) {
    return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
  }
  if (error instanceof AccesoError) {
    return Response.json({ error: mensajeAcceso(error.codigo) }, { status: estadoHttp(error.codigo), headers: PRIVADO });
  }
  return responderError(error);
}
