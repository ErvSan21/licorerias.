import { redirect } from "next/navigation";

import { EnvioPanel } from "@/components/panel/envio-panel";
import { BotonVolver } from "@/components/ui/boton-volver";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarEnvio } from "@/lib/envio/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function EnvioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/configuracion/envio`)}`);
  }
  const [contexto, lista] = await Promise.all([contextoPanel(normalizado), listarEnvio(normalizado)]);
  const sucursalId = contexto.seleccion;
  const tarifas = sucursalId ? lista.tarifas.filter((tarifa) => tarifa.sucursalId === sucursalId) : lista.tarifas;
  const lectura = contexto.staff.rol === "vendedor" || !contexto.vigente;
  const sucursal = sucursalId ? lista.sucursales.find((item) => item.id === sucursalId) : null;

  return (
    <main className="flex flex-col gap-4">
      <BotonVolver href={`/t/${contexto.tienda.slug}/configuracion`} etiqueta="Configuración" />
      <h2 className="text-pretty text-lg font-semibold">Envío{sucursal ? ` · ${sucursal.nombre}` : ""}</h2>
      {lectura ? (
        <p className="text-sm text-[var(--mu)]">
          {contexto.staff.rol === "vendedor"
            ? "Puedes consultar las tarifas. Los cambios los hace el dueño o el gerente."
            : "La licencia no está vigente. El envío está en solo lectura."}
        </p>
      ) : null}
      <EnvioPanel
        slug={contexto.tienda.slug}
        lectura={lectura}
        tarifas={tarifas}
        sucursales={lista.sucursales}
        sucursalFija={sucursalId}
      />
    </main>
  );
}
