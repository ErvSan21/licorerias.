import { PlanesPanel } from "@/components/administracion/planes-panel";
import { listarPlanesSuscripcion } from "@/lib/administracion/servicio";

export default async function PlanesPage() {
  const planes = await listarPlanesSuscripcion();
  return <PlanesPanel planes={planes} />;
}
