"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MenuDueno({ slug }: { slug: string }) {
  const actual = seccion(usePathname(), slug);
  return (
    <nav aria-label="Panel" className="flex flex-wrap gap-2">
      <Enlace href={`/t/${slug}`} activo={actual === "inicio"}>
        Inicio
      </Enlace>
      <Enlace href={`/t/${slug}/sucursales`} activo={actual === "sucursales"}>
        Sucursales
      </Enlace>
      <Enlace href={`/t/${slug}/personal`} activo={actual === "personal"}>
        Personal
      </Enlace>
      <Enlace href={`/t/${slug}/productos`} activo={actual === "productos"}>
        Productos
      </Enlace>
      <Enlace href={`/t/${slug}/productos/precios`} activo={actual === "precios"}>
        Precios
      </Enlace>
    </nav>
  );
}

export function MenuOperacion({ slug }: { slug: string }) {
  const actual = seccion(usePathname(), slug);
  return (
    <nav aria-label="Panel" className="flex flex-wrap gap-2">
      <Enlace href={`/t/${slug}`} activo={actual === "inicio"}>
        Inicio
      </Enlace>
      <Enlace href={`/t/${slug}/sucursales`} activo={actual === "sucursales"}>
        Sucursales
      </Enlace>
      <Enlace href={`/t/${slug}/productos`} activo={actual === "productos"}>
        Productos
      </Enlace>
      <Enlace href={`/t/${slug}/productos/precios`} activo={actual === "precios"}>
        Precios
      </Enlace>
    </nav>
  );
}

function seccion(pathname: string, slug: string): "inicio" | "sucursales" | "personal" | "productos" | "precios" {
  if (pathname.startsWith(`/t/${slug}/personal`)) return "personal";
  if (pathname.startsWith(`/t/${slug}/sucursales`)) return "sucursales";
  if (pathname.startsWith(`/t/${slug}/productos/precios`)) return "precios";
  if (pathname.startsWith(`/t/${slug}/productos`)) return "productos";
  return "inicio";
}

function Enlace({ href, activo, children }: { href: string; activo: boolean; children: string }) {
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
