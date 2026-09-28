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
import { accionPedido, etiquetaEstadoPedido, type EstadoPedido } from "@/lib/pedidos/reglas";
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
        <p className="text-sm text-zinc-700 dark:text-zinc-300">No hay pedidos con ese filtro.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((pedido) => (
            <li key={pedido.id} className="relative [content-visibility:auto]">
              {resaltados.has(pedido.id) ? <span aria-hidden="true" className="pedido-resalte pointer-events-none absolute inset-0 rounded-xl" /> : null}
              <article className="pedido-tarjeta">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-pretty text-base font-semibold">
                    <span className="tabular-nums text-[var(--mu)]">#{referenciaPedido(pedido.id)}</span>{" "}
                    {pedido.cliente}
                  </h3>
                  <Tag>{pedido.tipo === "delivery" ? "DELIVERY" : "RECOJO"}</Tag>
                  <Estado estado={pedido.estado} />
                </div>
                <p className="text-base font-semibold tabular-nums">{formatoBs(pedido.total)}</p>
                <p className="text-sm text-[var(--mu)]">
                  {pedido.sucursal} · {formatoFechaPrecio(pedido.creadoEn)}
                </p>
                {pedido.tipo === "recojo" && pedido.horaRecojo ? (
                  <p className="pedido-hora">Recojo {formatoFechaPrecio(pedido.horaRecojo)}</p>
                ) : null}
                {pedido.tipo === "delivery" ? (
                  <p className="text-sm text-[var(--mu)]">
                    {pedido.direccion}
                    {pedido.referencia ? ` · ${pedido.referencia}` : ""} · {pedido.distanciaKm} km · envío{" "}
                    <span className="tabular-nums text-[var(--tx)]">{formatoBs(pedido.costoEnvio)}</span>
                    {pedido.lat != null && pedido.lng != null ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={`https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`}
                          className="underline underline-offset-4"
                        >
                          Ver ubicación
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <Link
                  href={`/t/${slug}/pedidos/${pedido.id}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                >
                  Ver historial
                </Link>
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
        <Button type="button" variant="peligro" onClick={() => setCancelar(true)}>
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

function Filtros({
  slug,
  sucursales,
  filtro,
}: {
  slug: string;
  sucursales: Sucursal[];
  filtro: { estado: string | null; tipo: string | null; sucursalId: string | null; fecha: string | null };
}) {
  return (
    <form action={`/t/${slug}/pedidos`} className="grid gap-3 sm:grid-cols-2">
      <Campo id="filtro-estado" etiqueta="Estado">
        <select id="filtro-estado" name="estado" defaultValue={filtro.estado ?? ""} className={claseCampo}>
          <option value="">Todos</option>
          <option value="pendiente">Nuevo</option>
          <option value="aceptado">Aceptado</option>
          <option value="listo">Listo</option>
          <option value="enviado">Enviado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </Campo>
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
      <Button type="submit" variant="secundario">
        Filtrar
      </Button>
    </form>
  );
}

function Estado({ estado }: { estado: EstadoPedido }) {
  const tono = estado === "pendiente" ? "warn" : estado === "cancelado" ? "danger" : estado === "enviado" ? "brand" : "ok";
  return <Tag tono={tono}>{etiquetaEstadoPedido(estado)}</Tag>;
}

function referenciaPedido(id: string) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}
