"use client";

import Link from "next/link";

import { Catalogo } from "@/components/tienda/catalogo";
import { Checkout } from "@/components/tienda/checkout";
import { TiendaProvider, useTienda } from "@/components/tienda/contexto";
import { PuertaEdad } from "@/components/tienda/puerta-edad";
import { Button } from "@/components/ui/button";
import { formatoBs } from "@/lib/catalogo/reglas";
import type { Vitrina } from "@/lib/tienda/servicio";

export function TiendaPublica({ vitrina, telefonoInicial }: { vitrina: Vitrina; telefonoInicial: string }) {
  return (
    <PuertaEdad>
      <TiendaProvider vitrina={vitrina}>
        <Vista telefonoInicial={telefonoInicial} />
      </TiendaProvider>
    </PuertaEdad>
  );
}

function Vista({ telefonoInicial }: { telefonoInicial: string }) {
  const { estado, meta } = useTienda();
  const { tienda, sucursal } = meta.vitrina;

  return (
    <main className="mx-auto flex w-full max-w-lg scroll-pb-28 flex-col gap-4 px-4 py-6 pb-28">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{tienda.nombre}</p>
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">{sucursal.nombre}</h1>
        {sucursal.direccion ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{sucursal.direccion}</p> : null}
        <p className={sucursal.abiertaAhora ? "text-sm text-emerald-800 dark:text-emerald-200" : "text-sm text-zinc-600 dark:text-zinc-400"}>
          {sucursal.abiertaAhora ? "Abierta" : "Cerrada"}
        </p>
        <Link href={`/t/${tienda.slug}?elegir=1`} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
          Cambiar sucursal
        </Link>
      </header>
      {!sucursal.abiertaAhora ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          La sucursal está cerrada. Puedes mirar el catálogo, pero no confirmar un pedido.
        </p>
      ) : null}
      <Catalogo />
      <Checkout telefonoInicial={telefonoInicial} />
      {estado.cantidad > 0 ? <Barra /> : null}
    </main>
  );
}

function Barra() {
  const { estado, acciones, meta } = useTienda();
  return (
    <div
      role="region"
      aria-label="Carrito"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        <p key={estado.pulso} className="carrito-salto ui-movimiento text-sm font-semibold tabular-nums">
          {estado.cantidad} · {formatoBs(estado.total)}
        </p>
        <Button type="button" onClick={acciones.abrirCheckout} disabled={!meta.vitrina.sucursal.abiertaAhora}>
          Ver pedido
        </Button>
      </div>
    </div>
  );
}
