import Link from "next/link";
import { redirect } from "next/navigation";

import { AccionesPedido } from "@/components/panel/pedidos-panel";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import { etiquetaEntrega, etiquetaEstadoPedido } from "@/lib/pedidos/reglas";
import { leerPedido } from "@/lib/pedidos/servicio";
import { normalizarSlug } from "@/lib/tenant";

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string; pedidoId: string }>;
}) {
  const { slug, pedidoId } = await params;
  const normalizado = normalizarSlug(slug);
  if (!(await usuarioVerificado())) {
    redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/pedidos/${pedidoId}`)}`);
  }
  const [contexto, detalle] = await Promise.all([
    contextoPanel(normalizado),
    leerPedido(normalizado, pedidoId),
  ]);
  const { pedido, historial } = detalle;
  return (
    <main className="flex flex-col gap-4">
      <Link href={`/t/${contexto.tienda.slug}/pedidos`} className="min-h-11 text-sm font-medium underline underline-offset-4">
        Volver a pedidos
      </Link>
      <h2 className="text-pretty text-lg font-semibold">
        {etiquetaEntrega(pedido.tipo)} · {etiquetaEstadoPedido(pedido.estado)}
      </h2>
      <p className="text-sm">{pedido.cliente} · {pedido.telefono}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {pedido.items.map((item) => (
          <li key={item.productoId} className="tabular-nums">
            {item.cantidad} × {item.nombre} · {formatoBs(item.precioUnitario)}
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold tabular-nums">Total {formatoBs(pedido.total)}</p>
      {pedido.horaRecojo ? (
        <p className="text-base font-semibold">Recojo {formatoFechaPrecio(pedido.horaRecojo)}</p>
      ) : null}
      <section aria-labelledby="historial-pedido">
        <h3 id="historial-pedido" className="text-base font-semibold">
          Historial
        </h3>
        <ol className="mt-2 flex flex-col gap-1 text-sm">
          {historial.map((paso) => (
            <li key={`${paso.estado}-${paso.creadoEn}`}>
              {etiquetaEstadoPedido(paso.estado)} · {formatoFechaPrecio(paso.creadoEn)}
            </li>
          ))}
        </ol>
      </section>
      <AccionesPedido slug={contexto.tienda.slug} pedido={pedido} lectura={!contexto.vigente} />
    </main>
  );
}
