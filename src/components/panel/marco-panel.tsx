import Link from "next/link";

import { AvisoSoloLectura } from "@/components/aviso-solo-lectura";
import { AvisoPedidos } from "@/components/panel/aviso-pedidos";
import { MenuDueno, MenuOperacion } from "@/components/panel/menu-panel";
import { MenuPerfilTienda, type SucursalMenu } from "@/components/panel/menu-perfil";
import { SelectorTiendas } from "@/components/panel/selector-contexto";
import { BotonTema } from "@/components/ui/boton-tema";
import type { ContextoPanel } from "@/lib/auth/panel";
import { etiquetaRol } from "@/lib/tenant";

export async function MarcoPanel({
  contexto,
  children,
}: {
  contexto: ContextoPanel;
  children: React.ReactNode;
}) {
  const { tienda, staff, vigente, sucursales, tiendas, seleccion } = contexto;
  const paraMenu = sucursalesDeMenu(sucursales, seleccion);
  const iniciales = tienda.nombre.trim().slice(0, 1).toUpperCase() || "L";

  return (
    <AvisoPedidos slug={tienda.slug} sucursales={paraMenu.map((sucursal) => sucursal.id)}>
      <div className="panel-marco">
        <header className="panel-barra">
          <div className="panel-barra-fila">
            <div className="panel-identidad">
              <span className="panel-logo" aria-hidden="true">
                {iniciales}
              </span>
              <div className="min-w-0">
                <p className="panel-kicker">Licorerías</p>
                <h1 className="truncate text-lg">{tienda.nombre}</h1>
                <p className="text-sm text-[var(--mu)]">{etiquetaRol(staff.rol)}</p>
              </div>
            </div>
            <div className="panel-barra-acciones">
              <BotonTema />
              <MenuPerfilTienda
                slug={tienda.slug}
                sucursales={paraMenu}
                seleccion={seleccion}
              />
            </div>
          </div>
          {tiendas.length > 1 ? (
            <SelectorTiendas>
              {tiendas.map((item) => (
                <Link
                  key={item.id}
                  href={`/t/${item.slug}/panel`}
                  aria-current={item.id === tienda.id ? "page" : undefined}
                  translate="no"
                  className="panel-chip"
                >
                  {item.nombre}
                </Link>
              ))}
            </SelectorTiendas>
          ) : null}
        </header>
        <div id="contenido" className="panel-cuerpo">
          {vigente ? null : <AvisoSoloLectura />}
          {children}
        </div>
        {staff.rol === "dueno" ? (
          <MenuDueno slug={tienda.slug} />
        ) : (
          <MenuOperacion slug={tienda.slug} />
        )}
      </div>
    </AvisoPedidos>
  );
}

function sucursalesDeMenu(
  sucursales: ContextoPanel["sucursales"],
  seleccion: string | null,
): SucursalMenu[] {
  const ordenadas = sucursales.toSorted(
    (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"),
  );
  const idCentral = ordenadas[0]?.id ?? null;
  return ordenadas
    .filter((sucursal) => sucursal.activa || sucursal.id === seleccion)
    .toSorted((a, b) => {
      if (a.id === idCentral) return -1;
      if (b.id === idCentral) return 1;
      return a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");
    })
    .map((sucursal) => ({
      id: sucursal.id,
      nombre: sucursal.nombre,
      central: sucursal.id === idCentral,
    }));
}
