"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DESTINOS = [
  { href: "/administracion", etiqueta: "Dashboard", icono: "panel" },
  { href: "/administracion/tiendas", etiqueta: "Tiendas", icono: "tienda" },
  { href: "/administracion/usuarios", etiqueta: "Usuarios", icono: "personas" },
  { href: "/administracion/planes", etiqueta: "Planes", icono: "planes" },
] as const;

export function MenuAdministracion() {
  const pathname = usePathname();

  return (
    <nav className="menu-flotante" aria-label="Administración">
      {DESTINOS.map((destino) => {
        const activo =
          destino.href === "/administracion" ? pathname === "/administracion" : pathname.startsWith(destino.href);
        return (
          <Link
            key={destino.href}
            href={destino.href}
            aria-current={activo ? "page" : undefined}
            className="menu-flotante-item"
          >
            <Icono nombre={destino.icono} />
            <span className="menu-etiqueta">{destino.etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Icono({ nombre }: { nombre: (typeof DESTINOS)[number]["icono"] }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (nombre === "tienda") {
    return (
      <svg {...props}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
      </svg>
    );
  }
  if (nombre === "personas") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="2.2" />
        <path d="M4.8 18c.5-2.3 2.2-3.4 4.2-3.4s3.7 1.1 4.2 3.4" />
        <circle cx="16.2" cy="9" r="1.7" />
        <path d="M14.2 18c.3-1.5 1.4-2.3 2.8-2.3 1.1 0 2 .5 2.5 1.6" />
      </svg>
    );
  }
  if (nombre === "planes") {
    return (
      <svg {...props}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
