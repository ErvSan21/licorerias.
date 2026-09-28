import { notFound } from "next/navigation";

import { falloPublico } from "@/components/tienda/fallo-publico";
import { SeguimientoPedido } from "@/components/tienda/seguimiento";
import { esUuid } from "@/lib/licencias/reglas";
import { leerSeguimiento } from "@/lib/pedidos/servicio";
import { normalizarSlug, slugReservado, slugValido } from "@/lib/tenant";

export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const normalizado = normalizarSlug(slug);
  if (!slugValido(normalizado) || slugReservado(normalizado) || !esUuid(id)) notFound();

  let pedido;
  try {
    pedido = await leerSeguimiento(normalizado, id);
  } catch (error) {
    return falloPublico(error, normalizado);
  }
  return <SeguimientoPedido slug={normalizado} inicial={pedido} />;
}
