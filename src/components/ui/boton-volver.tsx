import Link from "next/link";

/** Enlace para volver: flecha dentro de un círculo y el nombre de la pantalla anterior. */
export function BotonVolver({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <Link href={href} className="boton-volver">
      <span aria-hidden="true" className="boton-volver-circulo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
      <span>{etiqueta}</span>
    </Link>
  );
}
