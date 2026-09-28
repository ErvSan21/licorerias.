import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { FormularioInvitar, FormularioPersona } from "@/components/panel/formulario-personal";
import { EmptyState } from "@/components/ui/empty-state";
import { AccesoError, NoEncontrado } from "@/lib/auth/errors";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarPersonal } from "@/lib/sucursales/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PersonalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const { personas, sucursales } = datos;
  const visibles = contexto.seleccion
    ? personas.filter(
        (persona) => persona.rol === "dueno" || persona.sucursalIds.includes(contexto.seleccion as string),
      )
    : personas;
  const opciones = sucursales
    .filter((sucursal) => sucursal.activa)
    .map((sucursal) => ({
      id: sucursal.id,
      nombre: sucursal.nombre,
    }));

  return (
    <main className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Personal</h2>
      <FormularioInvitar slug={contexto.tienda.slug} sucursales={opciones} lectura={!contexto.vigente} />
      {visibles.length === 0 ? (
        <EmptyState titulo="Nadie en esta vista" descripcion="Invita al personal de la sucursal." />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((persona) => (
            <li key={persona.id}>
              <FormularioPersona
                slug={contexto.tienda.slug}
                lectura={!contexto.vigente}
                persona={persona}
                sucursales={opciones}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
