export function AvisoSoloLectura() {
  return (
    <p
      role="status"
      className="rounded-lg border border-amber-800 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950 dark:border-amber-200 dark:bg-zinc-900 dark:text-amber-100"
    >
      La licencia no está vigente. Este panel está en solo lectura y la tienda pública muestra
      “Tienda no disponible”.
    </p>
  );
}
