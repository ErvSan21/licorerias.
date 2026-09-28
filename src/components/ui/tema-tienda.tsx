import { estiloMarca } from "@/components/ui/tema";
import { leerMarcaPublica } from "@/lib/marca/servicio";
import { slugReservado, slugValido } from "@/lib/tenant";

export async function TemaTienda({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  if (!slugValido(slug) || slugReservado(slug)) return children;

  let color: string | null = null;
  try {
    color = (await leerMarcaPublica(slug)).colorPrimario;
  } catch {
    color = null;
  }

  const style = estiloMarca(color);
  if (!style) return children;

  return (
    <div style={style} className="contents">
      {children}
    </div>
  );
}
