"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MenuDueno({ slug }: { slug: string }) {
  const actual = seccion(usePathname(), slug);
  return (
    <nav aria-label="Panel" className="flex flex-wrap gap-2">
      <Enlace href={`/t/${slug}/panel`} activo={actual === "inicio"}>
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
      <Enlace href={`/t/${slug}/inventario`} activo={actual === "inventario"}>
        Inventario
      </Enlace>
      <Enlace href={`/t/${slug}/ofertas`} activo={actual === "ofertas"}>
        Ofertas
      </Enlace>
      <Enlace href={`/t/${slug}/colecciones`} activo={actual === "colecciones"}>
        Colecciones
      </Enlace>
      <Enlace href={`/t/${slug}/envio`} activo={actual === "envio"}>
        Envío
      </Enlace>
      <Enlace href={`/t/${slug}/pedidos`} activo={actual === "pedidos"}>
        Pedidos
      </Enlace>
    </nav>
  );
}

export function MenuOperacion({ slug }: { slug: string }) {
  const actual = seccion(usePathname(), slug);
  return (
    <nav aria-label="Panel" className="flex flex-wrap gap-2">
      <Enlace href={`/t/${slug}/panel`} activo={actual === "inicio"}>
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
      <Enlace href={`/t/${slug}/inventario`} activo={actual === "inventario"}>
        Inventario
      </Enlace>
      <Enlace href={`/t/${slug}/ofertas`} activo={actual === "ofertas"}>
        Ofertas
      </Enlace>
      <Enlace href={`/t/${slug}/envio`} activo={actual === "envio"}>
        Envío
      </Enlace>
      <Enlace href={`/t/${slug}/pedidos`} activo={actual === "pedidos"}>
        Pedidos
      </Enlace>
    </nav>
  );
}

function seccion(
  pathname: string,
  slug: string,
): "inicio" | "vitrina" | "sucursales" | "personal" | "productos" | "precios" | "inventario" | "ofertas" | "colecciones" | "envio" | "pedidos" {
  if (pathname === `/t/${slug}/panel`) return "inicio";
  if (pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/s/`)) return "vitrina";
  if (pathname.startsWith(`/t/${slug}/personal`)) return "personal";
  if (pathname.startsWith(`/t/${slug}/sucursales`)) return "sucursales";
  if (pathname.startsWith(`/t/${slug}/pedidos`)) return "pedidos";
  if (pathname.startsWith(`/t/${slug}/envio`)) return "envio";
  if (pathname.startsWith(`/t/${slug}/colecciones`)) return "colecciones";
  if (pathname.startsWith(`/t/${slug}/ofertas`)) return "ofertas";
  if (pathname.startsWith(`/t/${slug}/inventario`)) return "inventario";
  if (pathname.startsWith(`/t/${slug}/productos/precios`)) return "precios";
  if (pathname.startsWith(`/t/${slug}/productos`)) return "productos";
  return "vitrina";
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
