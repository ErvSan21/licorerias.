import { exigirPanel } from "@/lib/auth/panel";
import { etiquetaRol } from "@/lib/tenant";

export default async function PanelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tienda, staff } = await exigirPanel(slug);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Inicio</h2>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Sesión de {etiquetaRol(staff.rol)} en {tienda.nombre}. El catálogo, las sucursales y los
        pedidos llegan en los módulos siguientes.
      </p>
    </section>
  );
}
