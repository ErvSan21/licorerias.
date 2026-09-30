import { notFound, redirect } from "next/navigation";

import { EscaparatePanel } from "@/components/tienda/escaparate";
import { falloPublico } from "@/components/tienda/fallo-publico";
import { cargarEscaparate } from "@/lib/tienda/servicio";
import { nombreVisible } from "@/lib/marca/reglas";
import { normalizarSlug, slugReservado, slugValido } from "@/lib/tenant";

export default async function TiendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!slugValido(normalizado) || slugReservado(normalizado)) notFound();

  let escaparate;
  try {
    escaparate = await cargarEscaparate(normalizado);
  } catch (error) {
    return falloPublico(error, normalizado);
  }
  if (escaparate.sucursales.length === 1) {
    redirect(`/t/${normalizado}/s/${escaparate.sucursales[0].slug}`);
  }
  if (escaparate.sucursales.length === 0) {
    return <SucursalesVacias nombre={nombreVisible(escaparate.marca, escaparate.nombre)} />;
  }
  return <EscaparatePanel escaparate={escaparate} />;
}

function SucursalesVacias({ nombre }: { nombre: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <h1 className="text-pretty text-2xl font-semibold tracking-tight">{nombre}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--mu)]">
        Esta tienda todavía no tiene sucursales abiertas.
      </p>
    </main>
  );
}
