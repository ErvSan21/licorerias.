import { notFound, redirect } from "next/navigation";

import { WhatsappPanel } from "@/components/panel/whatsapp-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarCredenciales } from "@/lib/whatsapp";
import { normalizarSlug } from "@/lib/tenant";

export default async function WhatsappPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/whatsapp`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();
  const credenciales = await listarCredenciales(normalizado);

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">WhatsApp</h2>
      <p className="max-w-lg text-pretty text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        El número de una sucursal se usa para sus pedidos. Si no tiene, se usa el de la tienda. El token queda cifrado
        y no vuelve al navegador.
      </p>
      {!contexto.vigente ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          La licencia no está vigente. WhatsApp está en solo lectura.
        </p>
      ) : null}
      <WhatsappPanel
        slug={contexto.tienda.slug}
        lectura={!contexto.vigente}
        sucursales={contexto.sucursales.map((sucursal) => ({ id: sucursal.id, nombre: sucursal.nombre }))}
        iniciales={credenciales}
      />
    </main>
  );
}
