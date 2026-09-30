import Link from "next/link";
import { redirect } from "next/navigation";

import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { normalizarSlug } from "@/lib/tenant";

type Ajuste = { href: string; titulo: string; descripcion: string; icono: "marca" | "envio" | "sucursales" | "personal" | "pagos" };

export default async function ConfiguracionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/configuracion`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  const dueno = contexto.staff.rol === "dueno";

  const base = `/t/${contexto.tienda.slug}`;
  const ajustes: Ajuste[] = [
    ...(dueno
      ? [
          {
            href: `${base}/configuracion/marca`,
            titulo: "Marca de la tienda",
            descripcion: "Nombre comercial, color, logo, banner y mensaje de bienvenida.",
            icono: "marca" as const,
          },
        ]
      : []),
    {
      href: `${base}/sucursales`,
      titulo: "Sucursales",
      descripcion: "Precios y productos de la central, horarios y apertura de cada sucursal.",
      icono: "sucursales",
    },
    {
      href: `${base}/configuracion/envio`,
      titulo: "Envío",
      descripcion: "Ubicación de la sucursal y tarifas por distancia para delivery.",
      icono: "envio",
    },
    ...(dueno
      ? [
          {
            href: `${base}/configuracion/pagos`,
            titulo: "Cobro con QR",
            descripcion: "La imagen del QR que ve el cliente al pagar con QR.",
            icono: "pagos" as const,
          },
          {
            href: `${base}/personal`,
            titulo: "Personal",
            descripcion: "Invita a gerentes y vendedores y elige en qué sucursal trabajan.",
            icono: "personal" as const,
          },
        ]
      : []),
  ];

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Configuración</h2>
      <ul className="stock-lista">
        {ajustes.map((ajuste) => (
          <li key={ajuste.href}>
            <Link href={ajuste.href} className="configuracion-fila">
              <span aria-hidden="true" className="configuracion-icono">
                <Icono nombre={ajuste.icono} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{ajuste.titulo}</span>
                <span className="block text-sm text-[var(--mu)]">{ajuste.descripcion}</span>
              </span>
              <span aria-hidden="true" className="text-[var(--mu)]">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Icono({ nombre }: { nombre: Ajuste["icono"] }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (nombre === "marca") {
    return (
      <svg {...props}>
        <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z" />
        <circle cx="7.5" cy="11" r="1" />
        <circle cx="10.5" cy="7.5" r="1" />
        <circle cx="15" cy="8" r="1" />
      </svg>
    );
  }
  if (nombre === "pagos") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
      </svg>
    );
  }
  if (nombre === "personal") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6" />
        <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
      </svg>
    );
  }
  if (nombre === "sucursales") {
    return (
      <svg {...props}>
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M9 20v-6h6v6" />
        <path d="M3 20h18" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}
