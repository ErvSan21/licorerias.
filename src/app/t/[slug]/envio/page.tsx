import { redirect } from "next/navigation";

import { EnvioPanel } from "@/components/panel/envio-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarEnvio } from "@/lib/envio/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function EnvioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/envio`)}`);
  }
  const [contexto, lista] = await Promise.all([contextoPanel(normalizado), listarEnvio(normalizado)]);
  const sucursalId = contexto.seleccion;
  const tarifas = sucursalId ? lista.tarifas.filter((tarifa) => tarifa.sucursalId === sucursalId) : lista.tarifas;
  const zonas = sucursalId ? lista.zonas.filter((zona) => zona.sucursalId === sucursalId) : lista.zonas;
  const lectura = contexto.staff.rol === "vendedor" || !contexto.vigente;

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Envío</h2>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Primero se mira si el punto cae en una zona bloqueada o con tarifa fija. Si no, se usa la distancia por calle
        y el primer rango que la cubre. El costo lo calcula el servidor.
      </p>
      {lectura ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {contexto.staff.rol === "vendedor"
            ? "Puedes consultar las tarifas. Los cambios los hace el dueño o el gerente."
            : "La licencia no está vigente. El envío está en solo lectura."}
        </p>
      ) : null}
      <EnvioPanel
        slug={contexto.tienda.slug}
        lectura={lectura}
        tarifas={tarifas}
        zonas={zonas}
        sucursales={lista.sucursales}
        sucursalFija={sucursalId}
      />
    </main>
  );
}
