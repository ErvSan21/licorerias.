"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { cambiarEstadoAccion } from "@/app/t/[slug]/pedidos/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import { accionPedido, etiquetaEntrega, etiquetaEstadoPedido, type EstadoPedido } from "@/lib/pedidos/reglas";
import type { PedidoLista } from "@/lib/pedidos/servicio";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

type Sucursal = { id: string; nombre: string };

export function PedidosPanel({
  slug,
  lectura,
  pedidos,
  sucursales,
  filtro,
  sucursalesVivas,
}: {
  slug: string;
  lectura: boolean;
  pedidos: PedidoLista[];
  sucursales: Sucursal[];
  filtro: { estado: string | null; tipo: string | null; sucursalId: string | null; fecha: string | null };
  sucursalesVivas: string[];
}) {
  const resaltados = usePedidosNuevos(sucursalesVivas);
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
              <article className="relative flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-pretty text-base font-semibold">
                    {etiquetaEntrega(pedido.tipo)} · {pedido.cliente}
                  </h3>
                  <Estado estado={pedido.estado} />
                </div>
                <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {pedido.sucursal} · {formatoBs(pedido.total)} · {formatoFechaPrecio(pedido.creadoEn)}
                </p>
                {pedido.tipo === "recojo" && pedido.horaRecojo ? (
                  <p className="text-base font-semibold">Recojo {formatoFechaPrecio(pedido.horaRecojo)}</p>
                ) : null}
                {pedido.tipo === "delivery" ? (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {pedido.direccion}
                    {pedido.referencia ? ` · ${pedido.referencia}` : ""} · {pedido.distanciaKm} km · envío{" "}
                    <span className="tabular-nums">{formatoBs(pedido.costoEnvio)}</span>
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
  const publicar = useToast();
  const principal = useAsyncAction(async () => {
    if (!accion) return "Listo.";
    const resultado = await cambiarEstadoAccion(slug, pedido.id, accion.estado);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const baja = useAsyncAction(async () => {
    const resultado = await cambiarEstadoAccion(slug, pedido.id, "cancelado");
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
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
            publicar("exito", hecho.valor.valor);
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
            publicar("exito", hecho.valor.valor);
            setCancelar(false);
          });
        }}
      />
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
  const tono =
    estado === "pendiente"
      ? "text-amber-800 dark:text-amber-200"
      : estado === "cancelado"
        ? "text-red-800 dark:text-red-200"
        : estado === "enviado"
          ? "text-sky-800 dark:text-sky-200"
          : "text-emerald-800 dark:text-emerald-200";
  return <p className={`text-sm font-medium ${tono}`}>{etiquetaEstadoPedido(estado)}</p>;
}

function usePedidosNuevos(sucursales: string[]) {
  const router = useRouter();
  const [resaltados, setResaltados] = useState<Set<string>>(() => new Set());
  const clave = sucursales.toSorted().join(",");

  useEffect(() => {
    const ids = clave ? clave.split(",") : [];
    const supabase = crearClienteNavegador();
    if (!supabase || ids.length === 0) return;
    const canal = supabase.channel(`pedidos-${clave.slice(0, 48)}`);
    for (const sucursalId of ids) {
      canal.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` },
        (payload) => {
          const id = String((payload.new as { id?: string }).id ?? "");
          if (!id) return;
          setResaltados((prev) => new Set(prev).add(id));
          sonar();
          startTransition(() => router.refresh());
          window.setTimeout(() => {
            setResaltados((prev) => {
              const siguiente = new Set(prev);
              siguiente.delete(id);
              return siguiente;
            });
          }, 2000);
        },
      );
    }
    canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [clave, router]);

  return resaltados;
}

function sonar() {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const ganancia = audio.createGain();
    osc.frequency.value = 880;
    ganancia.gain.value = 0.04;
    osc.connect(ganancia).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.12);
    osc.onended = () => void audio.close();
  } catch {
    // Sin audio no se pierde el pedido.
  }
}
