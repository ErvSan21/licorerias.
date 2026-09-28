"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAvisoPedidos } from "@/components/panel/aviso-pedidos";
import { Drawer } from "@/components/ui/drawer";

type Seccion =
  | "inicio"
  | "vitrina"
  | "sucursales"
  | "personal"
  | "productos"
  | "precios"
  | "inventario"
  | "ofertas"
  | "colecciones"
  | "envio"
  | "pedidos"
  | "reportes"
  | "marca"
  | "whatsapp";

type Destino = {
  id: Exclude<Seccion, "vitrina">;
  href: string;
  etiqueta: string;
  icono: IconoNombre;
};

type IconoNombre = "tienda" | "pedidos" | "precios" | "inventario" | "mas";

const PRINCIPALES: Destino["id"][] = ["inicio", "pedidos", "precios", "inventario"];

export function MenuDueno({ slug }: { slug: string }) {
  return (
    <MenuFlotante
      slug={slug}
      destinos={[
        destino(slug, "inicio", "Tienda", "tienda"),
        destino(slug, "pedidos", "Pedidos", "pedidos"),
        destino(slug, "precios", "Precios", "precios"),
        destino(slug, "inventario", "Inventario", "inventario"),
        destino(slug, "sucursales", "Sucursales", "tienda"),
        destino(slug, "personal", "Personal", "tienda"),
        destino(slug, "productos", "Productos", "inventario"),
        destino(slug, "ofertas", "Ofertas", "precios"),
        destino(slug, "colecciones", "Colecciones", "inventario"),
        destino(slug, "envio", "Envío", "pedidos"),
        destino(slug, "reportes", "Reportes", "precios"),
        destino(slug, "marca", "Marca", "tienda"),
        destino(slug, "whatsapp", "WhatsApp", "pedidos"),
      ]}
    />
  );
}

export function MenuOperacion({ slug, verReportes = false }: { slug: string; verReportes?: boolean }) {
  const destinos: Destino[] = [
    destino(slug, "inicio", "Tienda", "tienda"),
    destino(slug, "pedidos", "Pedidos", "pedidos"),
    destino(slug, "precios", "Precios", "precios"),
    destino(slug, "inventario", "Inventario", "inventario"),
    destino(slug, "sucursales", "Sucursales", "tienda"),
    destino(slug, "productos", "Productos", "inventario"),
    destino(slug, "ofertas", "Ofertas", "precios"),
    destino(slug, "envio", "Envío", "pedidos"),
  ];
  if (verReportes) destinos.push(destino(slug, "reportes", "Reportes", "precios"));
  return <MenuFlotante slug={slug} destinos={destinos} />;
}

function destino(slug: string, id: Destino["id"], etiqueta: string, icono: IconoNombre): Destino {
  const href =
    id === "inicio"
      ? `/t/${slug}/panel`
      : id === "precios"
        ? `/t/${slug}/productos/precios`
        : `/t/${slug}/${id}`;
  return { id, href, etiqueta, icono };
}

function partir(destinos: Destino[]) {
  if (destinos.length <= 5) return { barra: destinos, resto: [] as Destino[] };
  const barra = PRINCIPALES.flatMap((id) => {
    const item = destinos.find((destino) => destino.id === id);
    return item ? [item] : [];
  });
  const enBarra = new Set(barra.map((item) => item.id));
  return { barra, resto: destinos.filter((item) => !enBarra.has(item.id)) };
}

function MenuFlotante({ slug, destinos }: { slug: string; destinos: Destino[] }) {
  const actual = seccion(usePathname(), slug);
  const avisos = useAvisoPedidos();
  const [masAbierto, setMasAbierto] = useState(false);
  const { barra, resto } = partir(destinos);
  const masActivo = resto.some((item) => item.id === actual);

  return (
    <>
      <nav className="menu-flotante" aria-label="Panel">
        {barra.map((item) => (
          <EnlaceNav key={item.id} item={item} activo={actual === item.id} punto={item.id === "pedidos" && avisos.size > 0} />
        ))}
        {resto.length > 0 ? (
          <button
            type="button"
            className="menu-flotante-item"
            aria-current={masActivo ? "page" : undefined}
            aria-expanded={masAbierto}
            aria-haspopup="dialog"
            onClick={() => setMasAbierto(true)}
          >
            <Icono nombre="mas" />
            <span className="menu-etiqueta">Más</span>
          </button>
        ) : null}
      </nav>
      <Drawer abierto={masAbierto} titulo="Más" alCerrar={() => setMasAbierto(false)}>
        <ul className="menu-mas">
          {resto.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={actual === item.id ? "page" : undefined}
                className="menu-mas-enlace"
                onClick={() => setMasAbierto(false)}
              >
                <Icono nombre={item.icono} />
                {item.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
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
  if (nombre === "pedidos") {
    return (
      <svg {...props}>
        <path d="M7 4h10l1 3H6l1-3z" />
        <path d="M6 7h12l-1 13H7L6 7z" />
        <path d="M9 11h6" />
      </svg>
    );
  }
  if (nombre === "precios") {
    return (
      <svg {...props}>
        <path d="M12 3v18" />
        <path d="M16 7.5c0-1.5-1.6-2.5-4-2.5s-4 1-4 2.5 1.6 2.5 4 2.5 4 1 4 2.5-1.6 2.5-4 2.5-4-1-4-2.5" />
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
  if (nombre === "mas") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
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
  if (pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/s/`)) return "vitrina";
  if (pathname.startsWith(`/t/${slug}/personal`)) return "personal";
  if (pathname.startsWith(`/t/${slug}/sucursales`)) return "sucursales";
  if (pathname.startsWith(`/t/${slug}/reportes`)) return "reportes";
  if (pathname.startsWith(`/t/${slug}/marca`)) return "marca";
  if (pathname.startsWith(`/t/${slug}/whatsapp`)) return "whatsapp";
  if (pathname.startsWith(`/t/${slug}/pedidos`)) return "pedidos";
  if (pathname.startsWith(`/t/${slug}/envio`)) return "envio";
  if (pathname.startsWith(`/t/${slug}/colecciones`)) return "colecciones";
  if (pathname.startsWith(`/t/${slug}/ofertas`)) return "ofertas";
  if (pathname.startsWith(`/t/${slug}/inventario`)) return "inventario";
  if (pathname.startsWith(`/t/${slug}/productos/precios`)) return "precios";
  if (pathname.startsWith(`/t/${slug}/productos`)) return "productos";
  return "vitrina";
}
