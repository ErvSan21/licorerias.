"use client";

import Link from "next/link";

import { Catalogo } from "@/components/tienda/catalogo";
import { Checkout } from "@/components/tienda/checkout";
import { TiendaProvider, useTienda } from "@/components/tienda/contexto";
import { PuertaEdad } from "@/components/tienda/puerta-edad";
import { Button } from "@/components/ui/button";
import { ImagenConCarga } from "@/components/ui/imagen";
import { Marca } from "@/components/ui/marca";
import { formatoBs } from "@/lib/catalogo/reglas";
import { nombreVisible } from "@/lib/marca/reglas";
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
  const { tienda, sucursal, marca } = meta.vitrina;
  const nombre = nombreVisible(marca, tienda.nombre);

  return (
    <Marca color={marca.colorPrimario ?? undefined}>
    <main className="mx-auto flex w-full max-w-lg scroll-pb-28 flex-col gap-4 px-4 py-6 pb-28">
      {marca.bannerUrl ? (
        <ImagenConCarga src={marca.bannerUrl} alt="" width={640} height={200} className="h-32 w-full" />
      ) : null}
      <header className="flex min-w-0 items-center gap-3">
        {marca.logoUrl ? (
          <ImagenConCarga src={marca.logoUrl} alt="" width={48} height={48} className="size-12 shrink-0" />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm text-[var(--mu)]">{nombre}</p>
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">{sucursal.nombre}</h1>
        {sucursal.direccion ? <p className="text-sm text-[var(--mu)]">{sucursal.direccion}</p> : null}
        <p className={sucursal.abiertaAhora ? "text-sm text-[var(--ok)]" : "text-sm text-[var(--mu)]"}>
          {sucursal.abiertaAhora ? "Abierta" : "Cerrada"}
        </p>
        <Link href={`/t/${tienda.slug}?elegir=1`} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 touch-manipulation">
          Cambiar sucursal
        </Link>
        </div>
      </header>
      {marca.mensajeBienvenida ? (
        <p className="text-pretty text-sm leading-6 text-[var(--mu)]">{marca.mensajeBienvenida}</p>
      ) : null}
      {!sucursal.abiertaAhora ? (
        <p className="text-sm leading-6 text-[var(--mu)]">
          La sucursal está cerrada. Puedes mirar el catálogo, pero no confirmar un pedido.
        </p>
      ) : null}
      <Catalogo />
      <Checkout telefonoInicial={telefonoInicial} />
      {estado.cantidad > 0 ? <Barra /> : null}
    </main>
    </Marca>
  );
}

function Barra() {
  const { estado, acciones, meta } = useTienda();
  return (
    <div
      role="region"
      aria-label="Carrito"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ln)] bg-[var(--sf)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
