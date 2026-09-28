import { UsuariosPanel } from "@/components/administracion/usuarios-panel";
import { listarUsuarios } from "@/lib/administracion/servicio";

export default async function UsuariosPage() {
  const { tiendas, usuarios } = await listarUsuarios();

  return (
    <main className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Usuarios</h2>
      <UsuariosPanel tiendas={tiendas} usuarios={usuarios} />
    </main>
  );
}
