import "server-only";

import { AccesoError, estadoHttp, mensajeAcceso, NoEncontrado } from "@/lib/auth/errors";
import { responderError } from "@/lib/licencias/http";

const PRIVADO = { "Cache-Control": "private, no-store" };

export function jsonPrivado(datos: unknown, status = 200): Response {
  return Response.json(datos, { status, headers: PRIVADO });
}

export function responderOfertas(error: unknown): Response {
  if (error instanceof NoEncontrado) {
    return Response.json({ error: "No encontrado." }, { status: 404, headers: PRIVADO });
  }
  if (error instanceof AccesoError) {
    return Response.json(
      { error: mensajeAcceso(error.codigo) },
      { status: estadoHttp(error.codigo), headers: PRIVADO },
    );
  }
  return responderError(error);
}
