import { redirect } from "next/navigation";

import { PedidosPanel } from "@/components/panel/pedidos-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { listarPedidos } from "@/lib/pedidos/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PedidosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string; tipo?: string; sucursal?: string; fecha?: string }>;
}) {
  const { slug } = await params;
  const consulta = await searchParams;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/pedidos`)}`);
  }
  const filtro = {
    estado: consulta.estado || null,
    tipo: consulta.tipo || null,
    sucursalId: consulta.sucursal || null,
    fecha: consulta.fecha || null,
  };
  const [contexto, lista] = await Promise.all([
    contextoPanel(normalizado),
    listarPedidos(normalizado, filtro),
  ]);
  const sucursalVista = contexto.seleccion;
  const pedidos = sucursalVista ? lista.pedidos.filter((pedido) => pedido.sucursalId === sucursalVista) : lista.pedidos;
  const lectura = !contexto.vigente;

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-pretty text-lg font-semibold">Pedidos</h2>
      {lectura ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          La licencia no está vigente. Los pedidos están en solo lectura.
        </p>
      ) : null}
      <PedidosPanel
        slug={contexto.tienda.slug}
        lectura={lectura}
        pedidos={pedidos}
        sucursales={lista.sucursales}
        filtro={filtro}
        sucursalesVivas={sucursalVista ? [sucursalVista] : lista.sucursales.map((sucursal) => sucursal.id)}
      />
    </main>
  );
}
