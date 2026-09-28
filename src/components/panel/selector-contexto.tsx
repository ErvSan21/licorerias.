"use client";

import { useFormStatus } from "react-dom";

import { elegirSucursalAccion } from "@/app/t/[slug]/actions";

export function SelectorTiendas({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Tienda" className="flex flex-wrap gap-2">
      {children}
    </nav>
  );
}

export function SelectorSucursales({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Sucursal" className="flex gap-2 overflow-x-auto">
      {children}
    </nav>
  );
}

export function OpcionSucursal({
  slug,
  valor,
  activa,
  children,
}: {
  slug: string;
  valor: string;
  activa: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={elegirSucursalAccion}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sucursal" value={valor} />
      <BotonOpcion activa={activa}>{children}</BotonOpcion>
    </form>
  );
}

function BotonOpcion({ activa, children }: { activa: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-current={activa ? "page" : undefined}
      aria-busy={pending}
      className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium underline-offset-4 aria-[current=page]:border-zinc-900 aria-[current=page]:font-semibold aria-[current=page]:underline disabled:opacity-50 dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100"
    >
      {children}
    </button>
  );
}

export function BarraSucursalesDueno({
  slug,
  sucursales,
  seleccion,
}: {
  slug: string;
  sucursales: { id: string; nombre: string }[];
  seleccion: string | null;
}) {
  return (
    <SelectorSucursales>
      <OpcionSucursal slug={slug} valor="todas" activa={seleccion === null}>
        Todas las sucursales
      </OpcionSucursal>
      {sucursales.map((sucursal) => (
        <OpcionSucursal key={sucursal.id} slug={slug} valor={sucursal.id} activa={seleccion === sucursal.id}>
          {sucursal.nombre}
        </OpcionSucursal>
      ))}
    </SelectorSucursales>
  );
}

export function BarraSucursalesAsignadas({
  slug,
  sucursales,
  seleccion,
}: {
  slug: string;
  sucursales: { id: string; nombre: string }[];
  seleccion: string | null;
}) {
  return (
    <SelectorSucursales>
      {sucursales.map((sucursal) => (
        <OpcionSucursal key={sucursal.id} slug={slug} valor={sucursal.id} activa={seleccion === sucursal.id}>
          {sucursal.nombre}
        </OpcionSucursal>
      ))}
    </SelectorSucursales>
  );
}
