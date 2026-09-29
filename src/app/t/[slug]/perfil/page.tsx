import { redirect } from "next/navigation";

import { PantallaPerfil } from "@/components/ui/pantalla-perfil";
import { contextoPanel } from "@/lib/auth/panel";
import { usuarioVerificado } from "@/lib/auth/staff";
import { perfilDesdeMetadata } from "@/lib/perfil/reglas";
import { etiquetaRol, normalizarSlug } from "@/lib/tenant";

export default async function PerfilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizado = normalizarSlug(slug);
  const usuario = await usuarioVerificado();
  if (!usuario) redirect(`/login?siguiente=${encodeURIComponent(`/t/${normalizado}/perfil`)}`);
  const contexto = await contextoPanel(normalizado);

  return (
    <PantallaPerfil
      correo={usuario.email ?? ""}
      perfil={perfilDesdeMetadata(usuario.user_metadata)}
      detalle={`${etiquetaRol(contexto.staff.rol)} · ${contexto.tienda.nombre}`}
    />
  );
}
