export function AvisoSoloLectura() {
  return (
    <p
      role="status"
      className="rounded-lg border border-[var(--wa)] bg-[color-mix(in_srgb,var(--wa)_12%,var(--sf))] px-3 py-3 text-sm leading-6 text-[var(--tx)]"
    >
      La licencia no está vigente. Este panel está en solo lectura y la tienda pública muestra
      “Tienda no disponible”.
    </p>
  );
}
