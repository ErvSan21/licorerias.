"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { LineaTiempo } from "@/components/ui/movimientos";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import {
  indiceSeguimiento,
  intervaloSeguimientoMs,
  mensajeSeguimiento,
  pasosSeguimiento,
  seguimientoDesdeJson,
  type SeguimientoPublico,
} from "@/lib/pedidos/reglas";

export function SeguimientoPedido({ slug, inicial }: { slug: string; inicial: SeguimientoPublico }) {
  const [pedido, setPedido] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState(0);
  const indice = indiceSeguimiento(pedido.estado, pedido.tipoEntrega);
  const previo = useRef(indice);
  const mensaje = mensajeSeguimiento(pedido.estado, pedido.tipoEntrega);

  useEffect(() => {
    if (indice === previo.current) return;
    previo.current = indice;
    setCiclo((valor) => valor + 1);
  }, [indice]);

  useEffect(() => {
    let activo = true;
    const timer = window.setInterval(() => {
      void fetch(`/api/t/${slug}/pedido/${inicial.id}`, { cache: "no-store" })
        .then(async (respuesta) => {
          const cuerpo: unknown = await respuesta.json().catch(() => null);
          if (!activo) return;
          if (!respuesta.ok) {
            const error = cuerpo && typeof cuerpo === "object" && "error" in cuerpo ? String(cuerpo.error) : "";
            setAviso(error || "No se pudo actualizar el estado. Se reintentará.");
            return;
          }
          const siguiente = seguimientoDesdeJson(cuerpo);
          if (!siguiente) {
            setAviso("No se pudo actualizar el estado. Se reintentará.");
            return;
          }
          setPedido(siguiente);
          setAviso(null);
        })
        .catch(() => {
          if (activo) setAviso("No se pudo actualizar el estado. Se reintentará.");
        });
    }, intervaloSeguimientoMs);
    return () => {
      activo = false;
      window.clearInterval(timer);
    };
  }, [slug, inicial.id]);

  const pasos = pasosSeguimiento(pedido.tipoEntrega);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pedido <span translate="no">#{pedido.id.slice(0, 4).toUpperCase()}</span>
        </p>
        <h1 className="text-pretty text-2xl font-semibold tracking-tight">{mensaje}</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{pedido.sucursal}</p>
      </header>
      <p className="sr-only" role="status" aria-live="polite">
        {mensaje}
      </p>
      {pedido.estado === "cancelado" ? (
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Este pedido fue cancelado. Si ya pagaste o tienes dudas, escríbele a la sucursal.
        </p>
      ) : (
        <LineaTiempo pasos={pasos} actual={indice} ciclo={ciclo} />
      )}
      <section aria-labelledby="detalle-pedido" className="flex flex-col gap-3">
        <h2 id="detalle-pedido" className="scroll-mt-24 text-base font-semibold">
          Detalle
        </h2>
        {pedido.items.length === 0 ? (
          <EmptyState titulo="Sin productos" descripcion="Este pedido no tiene líneas para mostrar." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pedido.items.map((item, indice) => (
              <li key={`${indice}-${item.nombre}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words">{item.nombre}</span>
                  <span className="text-zinc-600 tabular-nums dark:text-zinc-400"> × {item.cantidad}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatoBs(item.precioUnitario * item.cantidad)}</span>
              </li>
            ))}
          </ul>
        )}
        {pedido.tipoEntrega === "delivery" ? (
          <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">Envío {formatoBs(pedido.costoEnvio)}</p>
        ) : null}
        {pedido.descuento > 0 ? (
          <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">Descuento {formatoBs(pedido.descuento)}</p>
        ) : null}
        <p className="text-base font-semibold tabular-nums">Total {formatoBs(pedido.total)}</p>
        {pedido.tipoEntrega === "recojo" ? (
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Recojo en {pedido.sucursal}
            {pedido.horaRecojo ? ` · ${formatoFechaPrecio(pedido.horaRecojo)}` : " · Lo antes posible"}
          </p>
        ) : (
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Delivery a {pedido.direccion || "la dirección indicada"}
            {pedido.referencia ? ` · ${pedido.referencia}` : ""}
          </p>
        )}
      </section>
      {aviso ? (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {aviso}
        </p>
      ) : null}
      <Link
        href={`/t/${slug}`}
        className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline underline-offset-4 hover:text-zinc-950 dark:hover:text-white"
      >
        Volver a la tienda
      </Link>
    </main>
  );
}
