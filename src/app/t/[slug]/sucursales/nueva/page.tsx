import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FormularioNuevaSucursal } from "@/components/panel/formulario-sucursal";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { normalizarSlug } from "@/lib/tenant";

export default async function NuevaSucursalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/sucursales/nueva`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();

  return (
    <main className="flex flex-col gap-4">
      <Link
        href={`/t/${contexto.tienda.slug}/sucursales`}
        className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline-offset-4 hover:underline"
      >
        Volver a sucursales
      </Link>
      <h2 className="text-lg font-semibold">Nueva sucursal</h2>
      <FormularioNuevaSucursal slug={contexto.tienda.slug} lectura={!contexto.vigente} />
    </main>
  );
}
