export type ResultadoGuardia<T> = { omitida: true } | { omitida: false; valor: T };

export function crearGuardiaAccion() {
  let ocupada = false;

  return {
    get ocupada() {
      return ocupada;
    },
    async ejecutar<T>(fn: () => Promise<T>): Promise<ResultadoGuardia<T>> {
      if (ocupada) return { omitida: true };
      ocupada = true;
      try {
        const valor = await fn();
        return { omitida: false, valor };
      } finally {
        ocupada = false;
      }
    },
  };
}

/** Ignora el clic si el botón ya está cargando o deshabilitado. */
export function activarBoton(
  estado: { loading?: boolean; disabled?: boolean },
  disparar: () => void,
): boolean {
  if (estado.loading || estado.disabled) return false;
  disparar();
  return true;
}
