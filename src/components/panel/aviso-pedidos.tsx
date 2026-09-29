"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, startTransition, use, useEffect, useRef, useState } from "react";

import { cambiarEstadoAccion } from "@/app/t/[slug]/pedidos/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatoBs } from "@/lib/catalogo/reglas";
import { referenciaPedido } from "@/lib/pedidos/reglas";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

const AvisoPedidosContext = createContext<Set<string>>(new Set());

/** Pedido de la tienda en línea que todavía nadie aceptó. */
type PorAceptar = { id: string; nombre: string; tipo: "delivery" | "recojo"; total: number };

type FilaPedido = {
  id?: string;
  estado?: string;
  origen?: string;
  cliente_nombre?: string;
  tipo_entrega?: string;
  total?: number | string;
};

const INTERVALO_TIMBRE_MS = 2500;

export function AvisoPedidos({
  slug,
  sucursales,
  children,
}: {
  slug: string;
  sucursales: string[];
  children: React.ReactNode;
}) {
  const { resaltados, porAceptar, quitar } = usePedidosNuevos(sucursales);
  return (
    <AvisoPedidosContext value={resaltados}>
      {children}
      <AvisoPorAceptar slug={slug} pedidos={porAceptar} alAceptar={quitar} />
    </AvisoPedidosContext>
  );
}

export function useAvisoPedidos() {
  return use(AvisoPedidosContext);
}

function usePedidosNuevos(sucursales: string[]) {
  const router = useRouter();
  const [resaltados, setResaltados] = useState<Set<string>>(() => new Set());
  const [porAceptar, setPorAceptar] = useState<PorAceptar[]>([]);
  const clave = sucursales.toSorted().join(",");

  function quitar(id: string) {
    setPorAceptar((prev) => prev.filter((pedido) => pedido.id !== id));
  }

  useEffect(() => {
    const ids = clave ? clave.split(",") : [];
    const supabase = crearClienteNavegador();
    if (!supabase || ids.length === 0) return;
    let cancelado = false;

    // Al entrar al panel, los pedidos web que siguen sin aceptar vuelven a sonar.
    void supabase
      .from("pedidos")
      .select("id, estado, origen, cliente_nombre, tipo_entrega, total")
      .in("sucursal_id", ids)
      .eq("estado", "pendiente")
      .eq("origen", "tienda")
      .order("creado_en")
      .then(({ data }) => {
        if (cancelado || !data) return;
        const pendientes = (data as FilaPedido[]).flatMap((fila) => {
          const pedido = porAceptarDe(fila);
          return pedido ? [pedido] : [];
        });
        setPorAceptar((prev) => unir(prev, pendientes));
      });

    const canal = supabase.channel(`pedidos-${clave.slice(0, 48)}`);
    for (const sucursalId of ids) {
      canal.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` },
        (payload) => {
          const fila = payload.new as FilaPedido;
          const id = String(fila.id ?? "");
          if (!id) return;
          const pedido = porAceptarDe(fila);
          if (pedido) setPorAceptar((prev) => unir(prev, [pedido]));
          setResaltados((prev) => new Set(prev).add(id));
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
      // Si otra persona lo acepta o lo cancela, deja de sonar aquí también.
      canal.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` },
        (payload) => {
          const fila = payload.new as FilaPedido;
          if (fila.id && fila.estado !== "pendiente") {
            setPorAceptar((prev) => prev.filter((pedido) => pedido.id !== fila.id));
          }
        },
      );
    }
    canal.subscribe();
    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
  }, [clave, router]);

  useTimbre(porAceptar.length > 0);

  return { resaltados, porAceptar, quitar };
}

function porAceptarDe(fila: FilaPedido): PorAceptar | null {
  if (!fila.id || fila.estado !== "pendiente" || fila.origen !== "tienda") return null;
  return {
    id: fila.id,
    nombre: fila.cliente_nombre?.trim() || "Cliente",
    tipo: fila.tipo_entrega === "delivery" ? "delivery" : "recojo",
    total: Number(fila.total ?? 0),
  };
}

function unir(actuales: PorAceptar[], nuevos: PorAceptar[]): PorAceptar[] {
  const vistos = new Set(actuales.map((pedido) => pedido.id));
  return [...actuales, ...nuevos.filter((pedido) => !vistos.has(pedido.id))];
}

/** Suena cada pocos segundos mientras haya pedidos sin aceptar. */
function useTimbre(activo: boolean) {
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!activo) return;
    // El navegador solo deja sonar después de un toque: se reanuda en cuanto la persona toca la pantalla.
    function reanudar() {
      void audio.current?.resume();
    }
    function timbre() {
      try {
        audio.current ??= new AudioContext();
        const contexto = audio.current;
        if (contexto.state === "suspended") void contexto.resume();
        const inicio = contexto.currentTime;
        for (const [paso, frecuencia] of [880, 1175, 880, 1175].entries()) {
          const osc = contexto.createOscillator();
          const ganancia = contexto.createGain();
          osc.type = "sine";
          osc.frequency.value = frecuencia;
          const desde = inicio + paso * 0.18;
          ganancia.gain.setValueAtTime(0.0001, desde);
          ganancia.gain.exponentialRampToValueAtTime(0.25, desde + 0.02);
          ganancia.gain.exponentialRampToValueAtTime(0.0001, desde + 0.16);
          osc.connect(ganancia).connect(contexto.destination);
          osc.start(desde);
          osc.stop(desde + 0.17);
        }
      } catch {
        // Sin audio igual se ve el aviso en pantalla.
      }
    }
    timbre();
    const intervalo = window.setInterval(timbre, INTERVALO_TIMBRE_MS);
    document.addEventListener("pointerdown", reanudar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("pointerdown", reanudar);
    };
  }, [activo]);

  useEffect(() => {
    return () => {
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
}

function AvisoPorAceptar({
  slug,
  pedidos,
  alAceptar,
}: {
  slug: string;
  pedidos: PorAceptar[];
  alAceptar: (id: string) => void;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [oculto, setOculto] = useState(false);
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primeroVisto, setPrimeroVisto] = useState<string | null>(null);
  const pedido = pedidos[0];

  // Un pedido nuevo vuelve a abrir el aviso aunque se haya cerrado.
  if ((pedido?.id ?? null) !== primeroVisto) {
    setPrimeroVisto(pedido?.id ?? null);
    setOculto(false);
    setError(null);
  }

  if (!pedido) return null;

  function aceptar() {
    setAceptando(true);
    setError(null);
    void cambiarEstadoAccion(slug, pedido.id, "aceptado").then((resultado) => {
      setAceptando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      alAceptar(pedido.id);
      publicar("exito", `Pedido #${referenciaPedido(pedido.id)} aceptado.`);
      startTransition(() => router.refresh());
    });
  }

  return (
    <>
      <Modal abierto={!oculto} titulo="¡Nuevo pedido!" alCerrar={() => setOculto(true)}>
        <div role="alert" className="flex flex-col gap-3">
          <div className="aviso-pedido-detalle">
            <p className="font-semibold">
              #{referenciaPedido(pedido.id)} · {pedido.nombre}
            </p>
            <p className="text-sm text-[var(--mu)]">
              {pedido.tipo === "delivery" ? "Delivery" : "Recojo en tienda"} · {formatoBs(pedido.total)}
            </p>
          </div>
          {pedidos.length > 1 ? (
            <p className="text-sm text-[var(--mu)]">
              Hay {pedidos.length} pedidos esperando. Suena hasta que se acepten todos.
            </p>
          ) : (
            <p className="text-sm text-[var(--mu)]">Suena hasta que lo aceptes.</p>
          )}
          {error ? (
            <p role="status" className="text-sm text-[var(--er)]">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" loading={aceptando} loadingLabel="Aceptando…" onClick={aceptar}>
              Aceptar pedido
            </Button>
            <Link
              href={`/t/${slug}/pedidos/${pedido.id}`}
              className="ui-boton ui-boton-secundario inline-flex min-h-11 flex-1 items-center justify-center px-4 font-semibold"
              onClick={() => setOculto(true)}
            >
              Ver pedido
            </Link>
          </div>
        </div>
      </Modal>
      {oculto ? (
        <button type="button" className="aviso-pedido-chip" onClick={() => setOculto(false)}>
          <span aria-hidden="true" className="aviso-pedido-punto ui-movimiento" />
          {pedidos.length === 1 ? "1 pedido por aceptar" : `${pedidos.length} pedidos por aceptar`}
        </button>
      ) : null}
    </>
  );
}
