import { headers } from "next/headers";

import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";
import { invitarPersonal, listarPersonal } from "@/lib/sucursales/servicio";

const PRIVADO = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { personas } = await listarPersonal(slug);
    return Response.json(
      {
        personas: personas.map((persona) => ({
          id: persona.id,
          rol: persona.rol,
          activo: persona.activo,
          correo: persona.correo,
          sucursalIds: persona.sucursalIds,
        })),
      },
      { headers: PRIVADO },
    );
  } catch (error) {
    return responder(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const datos = await request.formData();
    const cabeceras = await headers();
    const resultado = await invitarPersonal(
      slug,
      {
        correo: String(datos.get("correo") ?? ""),
        rol: String(datos.get("rol") ?? ""),
        sucursalIds: datos.getAll("sucursalId").map(String),
      },
      cabeceras.get("origin"),
    );
    return Response.json(resultado, { status: 201, headers: PRIVADO });
  } catch (error) {
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
