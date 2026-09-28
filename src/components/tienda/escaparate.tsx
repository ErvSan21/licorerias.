"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useState } from "react";

import { PuertaEdad } from "@/components/tienda/puerta-edad";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { sucursalMasCercana } from "@/lib/tienda/reglas";
import type { Escaparate } from "@/lib/tienda/servicio";

export function EscaparatePanel({ escaparate, elegir }: { escaparate: Escaparate; elegir: boolean }) {
  return (
    <PuertaEdad>
      <Selector escaparate={escaparate} elegir={elegir} />
    </PuertaEdad>
  );
}

function suscribirSucursal() {
  return () => undefined;
}

function leerSucursal(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}

function Selector({ escaparate, elegir }: { escaparate: Escaparate; elegir: boolean }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const clave = `lic-sucursal-publica:v1:${escaparate.slug}`;
  const guardada = useSyncExternalStore(suscribirSucursal, () => leerSucursal(clave), () => null);
  const recordar = !elegir && guardada != null && guardada !== "" && escaparate.sucursales.some((sucursal) => sucursal.slug === guardada);

  useEffect(() => {
    if (recordar && guardada) router.replace(`/t/${escaparate.slug}/s/${guardada}`);
  }, [recordar, guardada, escaparate.slug, router]);

  function ir(slug: string) {
    try {
      localStorage.setItem(clave, slug);
    } catch {
      // La elección vale para esta visita.
    }
    router.push(`/t/${escaparate.slug}/s/${slug}`);
  }

  if (guardada === null || recordar) {
    return (
      <div className="grid gap-3">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="text-pretty text-2xl font-semibold tracking-tight">{escaparate.nombre}</h1>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">Elige la sucursal.</p>
      <Button
        type="button"
        variant="secundario"
        onClick={() => {
          if (!navigator.geolocation) {
            setAviso("No pudimos usar tu ubicación. Elige la sucursal en la lista.");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (posicion) => {
              const slug = sucursalMasCercana(
                { lat: posicion.coords.latitude, lng: posicion.coords.longitude },
                escaparate.sucursales,
              );
              if (!slug) {
                setAviso("Ninguna sucursal tiene ubicación. Elige una de la lista.");
                return;
              }
              ir(slug);
            },
            () => setAviso("No pudimos usar tu ubicación. Elige la sucursal en la lista."),
          );
        }}
      >
        Usar mi ubicación
      </Button>
      {aviso ? (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {aviso}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {escaparate.sucursales.map((sucursal) => (
          <li key={sucursal.id}>
            <button
              type="button"
              onClick={() => ir(sucursal.slug)}
              className="ui-boton flex min-h-12 w-full flex-col items-start rounded-xl border border-zinc-200 px-3 py-2 text-left dark:border-zinc-800"
            >
              <span className="font-medium">{sucursal.nombre}</span>
              {sucursal.direccion ? <span className="text-sm text-zinc-700 dark:text-zinc-300">{sucursal.direccion}</span> : null}
              <span className={sucursal.abiertaAhora ? "text-sm text-emerald-800 dark:text-emerald-200" : "text-sm text-zinc-600 dark:text-zinc-400"}>
                {sucursal.abiertaAhora ? "Abierta" : "Cerrada"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
