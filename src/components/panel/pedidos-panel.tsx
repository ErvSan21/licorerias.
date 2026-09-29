"use client";

import Link from "next/link";
import { useState } from "react";

import { cambiarEstadoAccion } from "@/app/t/[slug]/pedidos/actions";
import { useAvisoPedidos } from "@/components/panel/aviso-pedidos";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import {
  accionPedido,
  etiquetaEstadoPedido,
  etiquetaMetodoPago,
  referenciaPedido,
  tonoEstadoPedido,
  type EstadoPedido,
} from "@/lib/pedidos/reglas";
import type { PedidoLista } from "@/lib/pedidos/servicio";

type Sucursal = { id: string; nombre: string };

export function PedidosPanel({
  slug,
  lectura,
  pedidos,
  sucursales,
  filtro,
}: {
  slug: string;
  lectura: boolean;
  pedidos: PedidoLista[];
  sucursales: Sucursal[];
  filtro: { estado: string | null; tipo: string | null; sucursalId: string | null; fecha: string | null };
  sucursalesVivas: string[];
}) {
  const resaltados = useAvisoPedidos();
  return (
    <div className="flex flex-col gap-4">
      <Filtros slug={slug} sucursales={sucursales} filtro={filtro} />
      {pedidos.length === 0 ? (
        <p className="text-sm text-[var(--mu)]">No hay pedidos con ese filtro.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((pedido) => (
            <li key={pedido.id} className="relative [content-visibility:auto]">
              {resaltados.has(pedido.id) ? <span aria-hidden="true" className="pedido-resalte pointer-events-none absolute inset-0 rounded-xl" /> : null}
              <article className="pedido-tarjeta">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-pretty text-base font-semibold">
                    <span className="tabular-nums">#{referenciaPedido(pedido.id)}</span> · {pedido.cliente}
                  </h3>
                  <Estado estado={pedido.estado} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Tag>{pedido.tipo === "delivery" ? "DELIVERY" : "RECOJO"}</Tag>
                    {pedido.metodoPago ? <Tag>{etiquetaMetodoPago(pedido.metodoPago).toUpperCase()}</Tag> : null}
                  </span>
                  <p className="font-display text-[17px] font-extrabold tabular-nums">{formatoBs(pedido.total)}</p>
                </div>
                {pedido.tipo === "recojo" && pedido.horaRecojo ? (
                  <p className="pedido-hora">Hora de recojo: {formatoFechaPrecio(pedido.horaRecojo)}</p>
                ) : null}
                {pedido.tipo === "delivery" ? (
                  <p className="text-sm text-[var(--mu)]">
                    {pedido.distanciaKm} km · envío <span className="tabular-nums">{formatoBs(pedido.costoEnvio)}</span> ·{" "}
                    {pedido.direccion}
                    {pedido.referencia ? ` · ${pedido.referencia}` : ""}
                    {pedido.lat != null && pedido.lng != null ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={`https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--br)]"
                        >
                          Ver ubicación
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--mu)]">
                  {pedido.sucursal} · {formatoFechaPrecio(pedido.creadoEn)} ·{" "}
                  <Link href={`/t/${slug}/pedidos/${pedido.id}`} className="font-medium text-[var(--br)]">
                    Ver historial
                  </Link>
                </p>
                <AccionesPedido slug={slug} pedido={pedido} lectura={lectura} />
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccionesPedido({
  slug,
  pedido,
  lectura,
}: {
  slug: string;
  pedido: PedidoLista;
  lectura: boolean;
}) {
  const accion = accionPedido(pedido.estado, pedido.tipo);
  const [cancelar, setCancelar] = useState(false);
  const [falloWhatsapp, setFalloWhatsapp] = useState(false);
  const publicar = useToast();
  const principal = useAsyncAction(async () => {
    if (!accion) return { aviso: "Listo.", whatsappOk: true };
    const resultado = await cambiarEstadoAccion(slug, pedido.id, accion.estado);
    if (!resultado.ok) throw new Error(resultado.error);
    return { aviso: resultado.aviso, whatsappOk: resultado.whatsappOk };
  });
  const baja = useAsyncAction(async () => {
    const resultado = await cambiarEstadoAccion(slug, pedido.id, "cancelado");
    if (!resultado.ok) throw new Error(resultado.error);
    return { aviso: resultado.aviso, whatsappOk: resultado.whatsappOk };
  });
  if (lectura || !accion) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        loading={principal.loading}
        loadingLabel="Guardando…"
        success={principal.success}
        error={principal.error ?? false}
        onClick={() => {
          void principal.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            const aviso = hecho.valor.valor;
            setFalloWhatsapp(!aviso.whatsappOk);
            publicar(aviso.whatsappOk ? "exito" : "aviso", aviso.aviso);
          });
        }}
      >
        {accion.etiqueta}
      </Button>
      {accion.cancelar ? (
        <Button type="button" size="sm" variant="peligro" onClick={() => setCancelar(true)}>
          Cancelar
        </Button>
      ) : null}
      <ConfirmDialog
        abierto={cancelar}
        titulo="Cancelar pedido"
        descripcion="Se devuelve el stock a esta sucursal."
        etiquetaConfirmar="Cancelar pedido"
        peligro
        cargando={baja.loading}
        error={baja.error}
        alCerrar={() => setCancelar(false)}
        alConfirmar={() => {
          void baja.run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            const aviso = hecho.valor.valor;
            setFalloWhatsapp(!aviso.whatsappOk);
            publicar(aviso.whatsappOk ? "exito" : "aviso", aviso.aviso);
            setCancelar(false);
          });
        }}
      />
      {falloWhatsapp ? (
        <p className="basis-full text-sm leading-6 text-zinc-800 dark:text-zinc-200">
          No se pudo avisar por WhatsApp.{" "}
          <a
            href={`https://wa.me/${pedido.telefono}`}
            target="_blank"
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 touch-manipulation"
            rel="noopener noreferrer"
          >
            Abrir chat
          </a>
        </p>
      ) : null}
    </div>
  );
}

const ESTADOS_FILTRO = [
  { valor: "", etiqueta: "Todos" },
  { valor: "pendiente", etiqueta: "Nuevos" },
  { valor: "aceptado", etiqueta: "Aceptados" },
  { valor: "listo", etiqueta: "Listos" },
  { valor: "enviado", etiqueta: "Enviados" },
  { valor: "cancelado", etiqueta: "Cancelados" },
] as const;

function Filtros({
  slug,
  sucursales,
  filtro,
}: {
  slug: string;
  sucursales: Sucursal[];
  filtro: { estado: string | null; tipo: string | null; sucursalId: string | null; fecha: string | null };
}) {
  const extras = [filtro.tipo, filtro.sucursalId, filtro.fecha].filter(Boolean).length;

  function enlace(estado: string) {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (filtro.tipo) params.set("tipo", filtro.tipo);
    if (filtro.sucursalId) params.set("sucursal", filtro.sucursalId);
    if (filtro.fecha) params.set("fecha", filtro.fecha);
    const consulta = params.toString();
    return consulta ? `/t/${slug}/pedidos?${consulta}` : `/t/${slug}/pedidos`;
  }

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Estado del pedido" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {ESTADOS_FILTRO.map((opcion) => {
          const activo = (filtro.estado ?? "") === opcion.valor;
          return (
            <Link
              key={opcion.valor || "todos"}
              href={enlace(opcion.valor)}
              aria-current={activo ? "page" : undefined}
              className={`ui-chip inline-flex shrink-0 items-center text-sm ${activo ? "ui-chip-activo" : ""}`}
            >
              {opcion.etiqueta}
            </Link>
          );
        })}
      </nav>
      <details className="group" open={extras > 0}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-[var(--mu)]">
          Más filtros{extras > 0 ? ` (${extras})` : ""}
        </summary>
        <form action={`/t/${slug}/pedidos`} className="grid gap-3 pt-2 sm:grid-cols-2">
          {filtro.estado ? <input type="hidden" name="estado" value={filtro.estado} /> : null}
          <Campo id="filtro-tipo" etiqueta="Entrega">
            <select id="filtro-tipo" name="tipo" defaultValue={filtro.tipo ?? ""} className={claseCampo}>
              <option value="">Todas</option>
              <option value="delivery">Delivery</option>
              <option value="recojo">Recojo</option>
            </select>
          </Campo>
          <Campo id="filtro-sucursal" etiqueta="Sucursal">
            <select id="filtro-sucursal" name="sucursal" defaultValue={filtro.sucursalId ?? ""} className={claseCampo}>
              <option value="">Todas</option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="filtro-fecha" etiqueta="Fecha">
            <input id="filtro-fecha" name="fecha" type="date" autoComplete="off" defaultValue={filtro.fecha ?? ""} className={claseCampo} />
          </Campo>
          <Button type="submit" variant="secundario" className="self-end">
            Filtrar
          </Button>
        </form>
      </details>
    </div>
  );
}

function Estado({ estado }: { estado: EstadoPedido }) {
  return <Tag tono={tonoEstadoPedido(estado)}>{etiquetaEstadoPedido(estado)}</Tag>;
}
