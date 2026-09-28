export type CodigoAcceso = "no_autenticado" | "prohibido" | "configuracion";

export class NoEncontrado extends Error {
  constructor() {
    super("no_encontrado");
    this.name = "NoEncontrado";
  }
}

export class AccesoError extends Error {
  readonly codigo: CodigoAcceso;

  constructor(codigo: CodigoAcceso) {
    super(codigo);
    this.name = "AccesoError";
    this.codigo = codigo;
  }
}

export function mensajeAcceso(codigo: CodigoAcceso): string {
  if (codigo === "no_autenticado") return "Tienes que entrar.";
  if (codigo === "configuracion") {
    return "Falta la configuración de Supabase en el servidor.";
  }
  return "No tienes acceso.";
}

export function estadoHttp(codigo: CodigoAcceso): number {
  if (codigo === "no_autenticado") return 401;
  if (codigo === "configuracion") return 503;
  return 403;
}
