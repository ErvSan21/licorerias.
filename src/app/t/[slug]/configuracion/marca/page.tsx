import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MarcaPanel } from "@/components/panel/marca-panel";
import { BotonVolver } from "@/components/ui/boton-volver";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerMarcaDueno } from "@/lib/marca/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function MarcaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/configuracion/marca`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();
  const marca = await leerMarcaDueno(normalizado);

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/configuracion`} etiqueta="Configuración" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-pretty text-lg font-semibold">Marca de la tienda</h2>
        <Link href={`/t/${contexto.tienda.slug}`} className="text-sm font-medium text-[var(--br)]">
          Ver la tienda
        </Link>
      </div>
      <MarcaPanel
        slug={contexto.tienda.slug}
        nombreTienda={contexto.tienda.nombre}
        lectura={!contexto.vigente}
        inicial={marca}
      />
    </main>
  );
}
