import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { DesactivarSucursal, FormularioEditarSucursal } from "@/components/panel/formulario-sucursal";
import { BotonVolver } from "@/components/ui/boton-volver";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { NegocioError } from "@/lib/licencias/reglas";
import { leerSucursal } from "@/lib/sucursales/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function EditarSucursalPage({
  params,
}: {
  params: Promise<{ slug: string; sucursalId: string }>;
}) {
  const { slug, sucursalId } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/sucursales/${sucursalId}`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();

  let sucursal;
  try {
    sucursal = (await leerSucursal(normalizado, sucursalId)).sucursal;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado || error instanceof NegocioError) notFound();
    if (error instanceof AccesoError) notFound();
    throw error;
  }

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/sucursales`} etiqueta="Sucursales" />
      <h2 className="break-words text-lg font-semibold">{sucursal.nombre}</h2>
      <FormularioEditarSucursal slug={contexto.tienda.slug} lectura={!contexto.vigente} sucursal={sucursal} />
      {contexto.vigente && sucursal.activa ? (
        <DesactivarSucursal slug={contexto.tienda.slug} sucursalId={sucursal.id} />
      ) : null}
    </main>
  );
}
