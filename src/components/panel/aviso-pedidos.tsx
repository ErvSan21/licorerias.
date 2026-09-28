"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, use, useEffect, useState } from "react";

import { crearClienteNavegador } from "@/lib/supabase/navegador";

const AvisoPedidosContext = createContext<Set<string>>(new Set());

export function AvisoPedidos({
  sucursales,
  children,
}: {
  sucursales: string[];
  children: React.ReactNode;
}) {
  const resaltados = usePedidosNuevos(sucursales);
  return <AvisoPedidosContext value={resaltados}>{children}</AvisoPedidosContext>;
}

export function useAvisoPedidos() {
  return use(AvisoPedidosContext);
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
