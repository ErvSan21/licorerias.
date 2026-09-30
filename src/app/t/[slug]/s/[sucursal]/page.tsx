import { notFound } from "next/navigation";

import { falloPublico } from "@/components/tienda/fallo-publico";
import { TiendaPublica } from "@/components/tienda/tienda-publica";
import { cargarEscaparate, cargarVitrina } from "@/lib/tienda/servicio";
import { telefonoDesdeConsulta } from "@/lib/tienda/reglas";
import { normalizarSlug, slugReservado, slugValido } from "@/lib/tenant";

export default async function SucursalPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; sucursal: string }>;
  searchParams: Promise<{ tel?: string | string[] }>;
}) {
  const { slug, sucursal } = await params;
  const consulta = await searchParams;
  const normalizado = normalizarSlug(slug);
  const sucursalSlug = normalizarSlug(sucursal);
  if (!slugValido(normalizado) || slugReservado(normalizado) || !slugValido(sucursalSlug)) notFound();
  const tel = Array.isArray(consulta.tel) ? consulta.tel[0] : consulta.tel;

  let vitrina;
  let escaparate;
  try {
    // Productos de esta sucursal y la lista de sucursales para cambiar de una a otra.
    [vitrina, escaparate] = await Promise.all([
      cargarVitrina(normalizado, sucursalSlug),
      cargarEscaparate(normalizado),
    ]);
  } catch (error) {
    return falloPublico(error, normalizado);
  }
  return (
    <TiendaPublica
      vitrina={vitrina}
      sucursales={escaparate.sucursales}
      telefonoInicial={telefonoDesdeConsulta(tel)}
    />
  );
}
