import { redirect } from "next/navigation";

import { PantallaPerfil } from "@/components/ui/pantalla-perfil";
import { usuarioVerificado } from "@/lib/auth/staff";
import { perfilDesdeMetadata } from "@/lib/perfil/reglas";

export default async function PerfilAdministracionPage() {
  const usuario = await usuarioVerificado();
  if (!usuario) redirect(`/login?siguiente=${encodeURIComponent("/administracion/perfil")}`);

  return (
    <PantallaPerfil
      correo={usuario.email ?? ""}
      perfil={perfilDesdeMetadata(usuario.user_metadata)}
      detalle="Administración de la plataforma"
    />
  );
}
