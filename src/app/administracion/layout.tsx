import { redirect, unstable_rethrow } from "next/navigation";

import { MenuAdministracion } from "@/components/administracion/menu";
import { MenuPerfil } from "@/components/administracion/menu-perfil";
import { BotonTema } from "@/components/ui/boton-tema";
import { AccesoError, mensajeAcceso } from "@/lib/auth/errors";
import { requireSuperAdmin, usuarioVerificado } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AccesoError && error.codigo === "no_autenticado") {
      redirect("/login?siguiente=/administracion");
    }
    if (error instanceof AccesoError && error.codigo === "prohibido") {
      redirect("/login");
    }
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return (
        <main className="mx-auto w-full max-w-md px-4 py-10">
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="mt-3 text-sm leading-6">{mensajeAcceso("configuracion")}</p>
        </main>
      );
    }
    throw error;
  }

  const usuario = await usuarioVerificado();

  return (
    <div className="panel-marco">
      <header className="panel-barra">
        <div className="panel-barra-fila">
          <div className="min-w-0">
            <p className="panel-kicker">Licorerías</p>
            <h1 className="text-lg">Administración</h1>
          </div>
          <div className="panel-barra-acciones">
            <BotonTema />
            <MenuPerfil correo={usuario?.email ?? ""} />
          </div>
        </div>
      </header>
      <div id="contenido" className="panel-cuerpo">
        {children}
      </div>
      <MenuAdministracion />
    </div>
  );
}
