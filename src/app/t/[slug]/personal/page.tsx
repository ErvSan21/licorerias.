import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { PersonalPanel } from "@/components/panel/personal-panel";
import { BotonVolver } from "@/components/ui/boton-volver";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarPersonal } from "@/lib/sucursales/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PersonalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/personal`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();

  let datos;
  try {
    datos = await listarPersonal(normalizado);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NoEncontrado || error instanceof AccesoError) notFound();
    throw error;
  }

  const sucursales = datos.sucursales
    .filter((sucursal) => sucursal.activa)
    .map((sucursal) => ({ id: sucursal.id, nombre: sucursal.nombre }));
  const personas = datos.personas.map((persona) => ({
    id: persona.id,
    rol: persona.rol,
    activo: persona.activo,
    correo: persona.correo,
    nombre: persona.nombre,
    sucursalIds: persona.sucursalIds,
    esYo: persona.id === datos.staff.miembroId,
  }));

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/configuracion`} etiqueta="Configuración" />
      {contexto.vigente ? null : (
        <p className="text-sm text-[var(--mu)]">La licencia no está vigente. El personal está en solo lectura.</p>
      )}
      <PersonalPanel
        slug={contexto.tienda.slug}
        personas={personas}
        sucursales={sucursales}
        lectura={!contexto.vigente}
      />
    </main>
  );
}
