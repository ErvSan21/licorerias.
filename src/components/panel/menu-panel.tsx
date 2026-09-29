"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAvisoPedidos } from "@/components/panel/aviso-pedidos";

type Seccion =
  | "inicio"
  | "ventas"
  | "vitrina"
  | "productos"
  | "pedidos"
  | "configuracion";

type Destino = {
  id: Exclude<Seccion, "vitrina">;
  href: string;
  etiqueta: string;
  icono: IconoNombre;
};

type IconoNombre = "tienda" | "ventas" | "pedidos" | "inventario" | "configuracion";

// Marca, Envío, Sucursales y Personal viven dentro de Configuración.
export function MenuDueno({ slug }: { slug: string }) {
  return (
    <MenuFlotante
      slug={slug}
      destinos={[
        destino(slug, "inicio", "Dashboard", "tienda"),
        destino(slug, "ventas", "Ventas", "ventas"),
        destino(slug, "productos", "Productos", "inventario"),
        destino(slug, "pedidos", "Pedidos", "pedidos"),
        destino(slug, "configuracion", "Configuración", "configuracion"),
      ]}
    />
  );
}

export function MenuOperacion({ slug }: { slug: string }) {
  const destinos: Destino[] = [
    destino(slug, "inicio", "Dashboard", "tienda"),
    destino(slug, "ventas", "Ventas", "ventas"),
    destino(slug, "productos", "Productos", "inventario"),
    destino(slug, "pedidos", "Pedidos", "pedidos"),
    destino(slug, "configuracion", "Configuración", "configuracion"),
  ];
  return <MenuFlotante slug={slug} destinos={destinos} />;
}

function destino(slug: string, id: Destino["id"], etiqueta: string, icono: IconoNombre): Destino {
  const href = id === "inicio" ? `/t/${slug}/panel` : `/t/${slug}/${id}`;
  return { id, href, etiqueta, icono };
}

function MenuFlotante({ slug, destinos }: { slug: string; destinos: Destino[] }) {
  const actual = seccion(usePathname(), slug);
  const avisos = useAvisoPedidos();

  return (
    <nav className="menu-flotante" aria-label="Panel">
      {destinos.map((item) => (
        <EnlaceNav key={item.id} item={item} activo={actual === item.id} punto={item.id === "pedidos" && avisos.size > 0} />
      ))}
    </nav>
  );
}

function EnlaceNav({ item, activo, punto }: { item: Destino; activo: boolean; punto: boolean }) {
  return (
    <Link href={item.href} aria-current={activo ? "page" : undefined} className="menu-flotante-item">
      <Icono nombre={item.icono} />
      <span className="menu-etiqueta">{item.etiqueta}</span>
      {punto ? <span className="menu-punto" aria-label="Pedido nuevo" /> : null}
    </Link>
  );
}

function Icono({ nombre }: { nombre: IconoNombre }) {
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
  if (nombre === "ventas") {
    return (
      <svg {...props}>
        <path d="M6 7h12l-1 11H7L6 7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
    );
  }
  if (nombre === "pedidos") {
    return (
      <svg {...props}>
        <path d="M7 4h10l1 3H6l1-3z" />
        <path d="M6 7h12l-1 13H7L6 7z" />
        <path d="M9 11h6" />
      </svg>
    );
  }
  if (nombre === "inventario") {
    return (
      <svg {...props}>
        <path d="M4 8l8-4 8 4-8 4-8-4z" />
        <path d="M4 8v8l8 4 8-4V8" />
        <path d="M12 12v8" />
      </svg>
    );
  }
  if (nombre === "configuracion") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function seccion(pathname: string, slug: string): Seccion {
  if (pathname === `/t/${slug}/panel`) return "inicio";
  if (pathname.startsWith(`/t/${slug}/ventas`)) return "ventas";
  if (pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/s/`)) return "vitrina";
  if (pathname.startsWith(`/t/${slug}/personal`)) return "configuracion";
  if (pathname.startsWith(`/t/${slug}/sucursales`)) return "configuracion";
  if (pathname.startsWith(`/t/${slug}/configuracion`)) return "configuracion";
  if (pathname.startsWith(`/t/${slug}/pedidos`)) return "pedidos";
  if (pathname.startsWith(`/t/${slug}/ofertas`)) return "productos";
  if (pathname.startsWith(`/t/${slug}/inventario`)) return "productos";
  if (pathname.startsWith(`/t/${slug}/productos`)) return "productos";
  return "vitrina";
}
