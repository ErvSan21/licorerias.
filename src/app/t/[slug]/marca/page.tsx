import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MarcaPanel } from "@/components/panel/marca-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerMarcaDueno } from "@/lib/marca/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function MarcaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/marca`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();
  const marca = await leerMarcaDueno(normalizado);

  return (
    <main className="flex flex-col gap-4">
      <h2 className="scroll-mt-24 text-pretty text-lg font-semibold">Marca</h2>
      <p className="max-w-lg text-pretty text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        El nombre, el logo, el color, el banner y el mensaje son de toda la tienda. El horario y la ubicación siguen en
        cada sucursal.{" "}
        <Link
          href={`/t/${contexto.tienda.slug}`}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 touch-manipulation"
        >
          Ver la tienda
        </Link>
      </p>
      {!contexto.vigente ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">La licencia no está vigente. La marca está en solo lectura.</p>
      ) : null}
      <MarcaPanel slug={contexto.tienda.slug} lectura={!contexto.vigente} inicial={marca} />
    </main>
  );
}
