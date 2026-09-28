"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { SkeletonCard } from "@/components/ui/skeleton";

const CLAVE = "lic-edad:v1";

function suscribir() {
  return () => undefined;
}

function leerEdad(): "si" | "preguntar" {
  try {
    return localStorage.getItem(CLAVE) === "si" ? "si" : "preguntar";
  } catch {
    return "preguntar";
  }
}

export function PuertaEdad({ children }: { children: ReactNode }) {
  const guardada = useSyncExternalStore(suscribir, leerEdad, () => "pendiente" as const);
  const [respuesta, setRespuesta] = useState<"si" | "rechazado" | null>(null);
  const estado = respuesta ?? guardada;

  if (estado === "si") return children;

  if (estado === "rechazado") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">Solo para mayores de 18</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">No podemos mostrarte el catálogo.</p>
      </main>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      {estado === "preguntar" ? (
        <Dialogo
          abierto
          titulo="¿Eres mayor de 18 años?"
          descripcion="Esta tienda vende bebidas alcohólicas."
          alCerrar={() => undefined}
          bloquearCierre
          alineacion="centro"
        >
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(CLAVE, "si");
                } catch {
                  // La confirmación vale para esta visita.
                }
                setRespuesta("si");
              }}
            >
              Sí, soy mayor de 18
            </Button>
            <Button type="button" variant="secundario" onClick={() => setRespuesta("rechazado")}>
              No
            </Button>
          </div>
        </Dialogo>
      ) : null}
    </>
  );
}
