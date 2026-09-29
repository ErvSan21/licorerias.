/**
 * Primera letra en mayúscula, el resto tal cual: "licorería centro" → "Licorería centro".
 * Se usa en nombres y textos que escribe la persona (no en correos, claves ni teléfonos).
 */
export function capitalizar(valor: string): string {
  const inicio = valor.search(/\S/);
  if (inicio < 0) return valor;
  return valor.slice(0, inicio) + valor.charAt(inicio).toLocaleUpperCase("es") + valor.slice(inicio + 1);
}
