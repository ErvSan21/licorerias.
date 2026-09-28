"use client";

import { createContext, use, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";

import { cx } from "@/components/ui/tokens";
import { usePresencia } from "@/components/ui/use-presencia";

type Tono = "exito" | "error" | "aviso";

type Aviso = { id: string; tono: Tono; mensaje: string };

type ValorToast = {
  state: { avisos: Aviso[] };
  actions: {
    publicar: (tono: Tono, mensaje: string) => void;
    cerrar: (id: string) => void;
  };
};

const ContextoToast = createContext<ValorToast | null>(null);

const TONOS: Record<Tono, string> = {
  exito: "ui-aviso-exito",
  error: "ui-aviso-error",
  aviso: "ui-aviso-aviso",
};

export function ProveedorToast({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const serie = useRef(0);

  const actions = useMemo(
    () => ({
      publicar(tono: Tono, mensaje: string) {
        serie.current += 1;
        const id = `aviso-${serie.current}`;
        setAvisos((actual) => [...actual, { id, tono, mensaje }]);
      },
      cerrar(id: string) {
        setAvisos((actual) => actual.filter((aviso) => aviso.id !== id));
      },
    }),
    [],
  );

  const valor = useMemo(() => ({ state: { avisos }, actions }), [avisos, actions]);

  return (
    <ContextoToast value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {avisos.map((aviso) => (
          <AvisoToast key={aviso.id} aviso={aviso} alCerrar={() => actions.cerrar(aviso.id)} />
        ))}
      </div>
    </ContextoToast>
  );
}

export function useToast() {
  const valor = use(ContextoToast);
  if (!valor) {
    throw new Error("useToast debe usarse dentro de ProveedorToast.");
  }
  return valor.actions.publicar;
}

function AvisoToast({ aviso, alCerrar }: { aviso: Aviso; alCerrar: () => void }) {
  const [abierto, setAbierto] = useState(true);
  const { montado, visible } = usePresencia(abierto);
  const cerrar = useEffectEvent(alCerrar);

  useEffect(() => {
    const timer = setTimeout(() => setAbierto(false), 4000);
    return () => clearTimeout(timer);
  }, [aviso.id]);

  useEffect(() => {
    if (!abierto && !montado) cerrar();
  }, [abierto, montado]);

  if (!montado) return null;

  return (
    <div
      className={cx(
        "ui-dialogo ui-aviso ui-movimiento pointer-events-auto flex w-full max-w-sm items-start gap-3 px-3 py-3 text-sm",
        TONOS[aviso.tono],
      )}
      data-abierto={visible ? "true" : "false"}
      role={aviso.tono === "error" ? "alert" : "status"}
      aria-live={aviso.tono === "error" ? "assertive" : "polite"}
    >
      <p className="flex-1 leading-5">{aviso.mensaje}</p>
      <button type="button" className="ui-boton ui-boton-fantasma min-h-10 min-w-10 shrink-0 px-2 text-sm" onClick={() => setAbierto(false)}>
        Cerrar
      </button>
    </div>
  );
}
