"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Catalogo } from "@/components/tienda/catalogo";
import { Checkout } from "@/components/tienda/checkout";
import { TiendaProvider, useTienda } from "@/components/tienda/contexto";
import { recordarSucursal } from "@/components/tienda/escaparate";
import { PuertaEdad } from "@/components/tienda/puerta-edad";
import { ImagenConCarga } from "@/components/ui/imagen";
import { Marca } from "@/components/ui/marca";
import { Tag } from "@/components/ui/tag";
import { formatoBs } from "@/lib/catalogo/reglas";
import { nombreVisible } from "@/lib/marca/reglas";
import type { SucursalPublica, Vitrina } from "@/lib/tienda/servicio";

export function TiendaPublica({
  vitrina,
  sucursales,
  telefonoInicial,
}: {
  vitrina: Vitrina;
  sucursales: SucursalPublica[];
  telefonoInicial: string;
}) {
  return (
    <PuertaEdad>
      <TiendaProvider vitrina={vitrina}>
        <Vista sucursales={sucursales} telefonoInicial={telefonoInicial} />
      </TiendaProvider>
    </PuertaEdad>
  );
}

function Vista({ sucursales, telefonoInicial }: { sucursales: SucursalPublica[]; telefonoInicial: string }) {
  const router = useRouter();
  const [cambiando, iniciarCambio] = useTransition();
  const { estado, meta } = useTienda();
  const { tienda, sucursal, marca } = meta.vitrina;
  const nombre = nombreVisible(marca, tienda.nombre);

  function elegir(slug: string) {
    if (slug === sucursal.slug) return;
    recordarSucursal(tienda.slug, slug);
    // Cambia de sucursal sin volver arriba: los productos se reemplazan en su lugar.
    iniciarCambio(() => router.push(`/t/${tienda.slug}/s/${slug}`, { scroll: false }));
  }

  return (
    <Marca color={marca.colorPrimario ?? undefined}>
      <main className="tienda">
        <section className={`tienda-portada ${marca.bannerUrl ? "tienda-portada-banner" : ""}`}>
          {marca.bannerUrl ? (
            <ImagenConCarga src={marca.bannerUrl} alt="" width={1200} height={400} className="tienda-portada-imagen" />
          ) : null}
          <div className="tienda-portada-texto">
            {marca.logoUrl ? (
              <ImagenConCarga src={marca.logoUrl} alt="" width={56} height={56} className="tienda-logo" />
            ) : null}
            <div className="min-w-0">
              <h1 className="tienda-nombre">{nombre}</h1>
              {marca.mensajeBienvenida ? <p className="tienda-bienvenida">{marca.mensajeBienvenida}</p> : null}
            </div>
          </div>
        </section>

        {sucursales.length > 0 ? (
          <div className="tienda-sucursales" role="radiogroup" aria-label="Sucursal">
            {sucursales.map((item, indice) => {
              const activa = item.slug === sucursal.slug;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  className="tienda-sucursal"
                  onClick={() => elegir(item.slug)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{item.nombre}</span>
                    {indice === 0 && sucursales.length > 1 && !/central/i.test(item.nombre) ? (
                      <Tag tono="brand">Central</Tag>
                    ) : null}
                  </span>
                  {item.direccion ? <span className="tienda-sucursal-direccion">{item.direccion}</span> : null}
                  <span className={item.abiertaAhora ? "tienda-sucursal-estado text-[var(--ok)]" : "tienda-sucursal-estado"}>
                    {item.abiertaAhora ? "Abierta" : "Cerrada"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!sucursal.abiertaAhora ? (
          <p role="status" className="tienda-aviso">
            {sucursal.nombre} está cerrada. Puedes ver los productos, pero no confirmar el pedido.
          </p>
        ) : null}

        <div className={cambiando ? "tienda-cambiando" : undefined} aria-busy={cambiando || undefined}>
          <Catalogo />
        </div>
        <Checkout telefonoInicial={telefonoInicial} />
        {estado.cantidad > 0 && !estado.checkout ? <BotonPedido /> : null}
      </main>
    </Marca>
  );
}

function BotonPedido() {
  const { estado, acciones } = useTienda();
  return (
    <button
      type="button"
      key={estado.pulso}
      className="venta-flotante tienda-flotante carrito-salto ui-movimiento"
      onClick={acciones.abrirCheckout}
    >
      <span className="venta-flotante-contador tabular-nums">{estado.cantidad}</span>
      Realizar pedido · <span className="tabular-nums">{formatoBs(estado.total)}</span>
    </button>
  );
}
