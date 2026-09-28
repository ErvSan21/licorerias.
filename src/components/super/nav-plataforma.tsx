"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavPlataforma() {
  const pathname = usePathname();
  const tiendas = pathname === "/super" || pathname.startsWith("/super/tiendas");
  const nueva = pathname.startsWith("/super/nueva");

  return (
    <nav aria-label="Plataforma" className="flex flex-wrap gap-2">
      <Enlace href="/super" activo={tiendas}>
        Tiendas
      </Enlace>
      <Enlace href="/super/nueva" activo={nueva}>
        Nueva tienda
      </Enlace>
    </nav>
  );
}

function Enlace({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className="inline-flex min-h-11 touch-manipulation items-center rounded-lg px-3 text-sm font-medium underline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:underline"
    >
      {children}
    </Link>
  );
}
