import { headers } from "next/headers";
import { notFound, unstable_rethrow } from "next/navigation";

import { MarcoPanel } from "@/components/panel/marco-panel";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { normalizarSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  const ruta = (await headers()).get("x-ruta") ?? "";
  if (esVitrina(ruta, normalizado)) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }
  const user = await usuarioVerificado();
  if (!user) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  let contexto;
  try {
    contexto = await contextoPanel(normalizado);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado) notFound();
    if (error instanceof AccesoError && error.codigo === "prohibido") notFound();
    if (error instanceof AccesoError && error.codigo === "no_autenticado") {
      return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
    }
    throw error;
  }

  return <MarcoPanel contexto={contexto}>{children}</MarcoPanel>;
}

function esVitrina(ruta: string, slug: string) {
  if (!ruta || !slug) return false;
  const base = `/t/${slug}`;
  return ruta === base || ruta.startsWith(`${base}/s/`);
}
