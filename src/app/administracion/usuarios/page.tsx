import { UsuariosPanel } from "@/components/administracion/usuarios-panel";
import { listarUsuarios } from "@/lib/administracion/servicio";

export default async function UsuariosPage() {
  const { tiendas, usuarios } = await listarUsuarios();
  return <UsuariosPanel tiendas={tiendas} usuarios={usuarios} />;
}
