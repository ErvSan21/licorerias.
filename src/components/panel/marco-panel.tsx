import Link from "next/link";

import { salir } from "@/app/login/actions";
import { AvisoSoloLectura } from "@/components/aviso-solo-lectura";
import { BotonPendiente } from "@/components/boton-pendiente";
import { MenuDueno, MenuOperacion } from "@/components/panel/menu-panel";
import {
  BarraSucursalesAsignadas,
  BarraSucursalesDueno,
  SelectorTiendas,
} from "@/components/panel/selector-contexto";
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

  return (
    <div className="flex min-h-full flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Licorerías</p>
              <h1 className="break-words text-xl font-semibold tracking-tight">{tienda.nombre}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{etiquetaRol(staff.rol)}</p>
            </div>
            <form action={salir} className="sm:w-40">
              <BotonPendiente idle="Salir" pending="Saliendo…" variant="contorno" />
            </form>
          </div>
          {tiendas.length > 1 ? (
            <SelectorTiendas>
              {tiendas.map((item) => (
                <Link
                  key={item.id}
                  href={`/t/${item.slug}/panel`}
                  aria-current={item.id === tienda.id ? "page" : undefined}
                  translate="no"
                  className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium underline-offset-4 aria-[current=page]:border-zinc-900 aria-[current=page]:font-semibold aria-[current=page]:underline dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100"
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
          {staff.rol === "dueno" ? <MenuDueno slug={tienda.slug} /> : <MenuOperacion slug={tienda.slug} />}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        {vigente ? null : <AvisoSoloLectura />}
        {children}
      </div>
    </div>
  );
}
