import Link from "next/link";

import { salir } from "@/app/login/actions";
import { AvisoSoloLectura } from "@/components/aviso-solo-lectura";
import { BotonPendiente } from "@/components/boton-pendiente";
import { AvisoPedidos } from "@/components/panel/aviso-pedidos";
import { MenuDueno, MenuOperacion } from "@/components/panel/menu-panel";
import {
  BarraSucursalesAsignadas,
  BarraSucursalesDueno,
  SelectorTiendas,
} from "@/components/panel/selector-contexto";
import { BotonTema } from "@/components/ui/boton-tema";
import type { ContextoPanel } from "@/lib/auth/panel";
import { etiquetaRol } from "@/lib/tenant";

export function MarcoPanel({
  contexto,
  children,
}: {
  contexto: ContextoPanel;
  children: React.ReactNode;
}) {
  const { tienda, staff, vigente, sucursales, tiendas, seleccion } = contexto;
  const activas = sucursales.filter((sucursal) => sucursal.activa || sucursal.id === seleccion);
  const iniciales = tienda.nombre.trim().slice(0, 1).toUpperCase() || "L";

  return (
    <AvisoPedidos sucursales={activas.map((sucursal) => sucursal.id)}>
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
              <form action={salir} className="panel-salir">
                <BotonPendiente idle="Salir" pending="Saliendo…" variant="contorno" />
              </form>
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
          {staff.rol === "dueno" ? (
            <BarraSucursalesDueno slug={tienda.slug} sucursales={activas} seleccion={seleccion} />
          ) : (
            <BarraSucursalesAsignadas slug={tienda.slug} sucursales={activas} seleccion={seleccion} />
          )}
        </header>
        <div id="contenido" className="panel-cuerpo">
          {vigente ? null : <AvisoSoloLectura />}
          {children}
        </div>
        {staff.rol === "dueno" ? (
          <MenuDueno slug={tienda.slug} />
        ) : (
          <MenuOperacion slug={tienda.slug} verReportes={staff.rol === "gerente"} />
        )}
      </div>
    </AvisoPedidos>
  );
}
