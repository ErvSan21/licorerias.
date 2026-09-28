import "server-only";

import { AccesoError, estadoHttp, mensajeAcceso } from "@/lib/auth/errors";

import { NegocioError } from "./reglas";
import { cabecerasPrivadas } from "./servicio";

export function responderError(error: unknown): Response {
  if (error instanceof AccesoError) {
    return Response.json(
      { error: mensajeAcceso(error.codigo) },
      { status: estadoHttp(error.codigo), headers: cabecerasPrivadas() },
    );
  }
  if (error instanceof NegocioError) {
    return Response.json(
      { error: error.message },
      { status: 400, headers: cabecerasPrivadas() },
    );
  }

  console.error(error);
  return Response.json(
    { error: "No se pudo completar la solicitud." },
    { status: 500, headers: cabecerasPrivadas() },
  );
}

export function mensajePublico(error: unknown): string {
  if (error instanceof NegocioError || error instanceof AccesoError) {
    return error instanceof AccesoError ? mensajeAcceso(error.codigo) : error.message;
  }
  return "No se pudo completar. Inténtalo de nuevo.";
}
