/** Punto de extensión del Módulo 10. Vacío a propósito. */
export async function notificarEstado(pedidoId: string, estado: string): Promise<void> {
  try {
    void pedidoId;
    void estado;
  } catch {
    // Un fallo de aviso no puede revertir el pedido.
  }
}
