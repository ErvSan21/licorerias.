"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { EstadoCarga, Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import type { Escaparate } from "@/lib/tienda/servicio";

function clave(tienda: string) {
  return `lic-sucursal-publica:v1:${tienda}`;
}

/** Recuerda la última sucursal que eligió el cliente en este navegador. */
export function recordarSucursal(tienda: string, sucursal: string) {
  try {
    localStorage.setItem(clave(tienda), sucursal);
  } catch {
    // La elección vale para esta visita.
  }
}

function sucursalGuardada(tienda: string): string {
  try {
    return localStorage.getItem(clave(tienda)) ?? "";
  } catch {
    return "";
  }
}

/** La tienda sin sucursal abre la última elegida o la central; se cambia desde la misma tienda. */
export function EscaparatePanel({ escaparate }: { escaparate: Escaparate }) {
  const router = useRouter();

  useEffect(() => {
    const guardada = sucursalGuardada(escaparate.slug);
    const destino = escaparate.sucursales.some((sucursal) => sucursal.slug === guardada)
      ? guardada
      : escaparate.sucursales[0]?.slug;
    if (destino) router.replace(`/t/${escaparate.slug}/s/${destino}`);
  }, [escaparate, router]);

  return (
    <EstadoCarga etiqueta="Abriendo la tienda…" className="tienda">
      <Skeleton className="h-40 w-full rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </EstadoCarga>
  );
}
