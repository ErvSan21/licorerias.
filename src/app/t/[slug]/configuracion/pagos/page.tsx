import { notFound, redirect } from "next/navigation";

import { PagoQrPanel } from "@/components/panel/pago-qr-panel";
import { BotonVolver } from "@/components/ui/boton-volver";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { leerQrPagoDueno } from "@/lib/marca/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PagosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/configuracion/pagos`)}`);
  }
  const contexto = await contextoPanel(normalizado);
  if (contexto.staff.rol !== "dueno") notFound();
  const qr = await leerQrPagoDueno(normalizado);

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/configuracion`} etiqueta="Configuración" />
      <h2 className="text-pretty text-lg font-semibold">Cobro con QR</h2>
      <PagoQrPanel slug={contexto.tienda.slug} actual={qr} lectura={!contexto.vigente} />
    </main>
  );
}
