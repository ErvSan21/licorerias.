"use client";

import { useState } from "react";

import { cambiarAbiertaAccion } from "@/app/t/[slug]/actions";
import { useToast } from "@/components/ui/toast";

export function InterruptorAbierta({
  slug,
  sucursalId,
  abierta,
  lectura,
}: {
  slug: string;
  sucursalId: string;
  abierta: boolean;
  lectura: boolean;
}) {
  const [valor, setValor] = useState(abierta);
  const [base, setBase] = useState(abierta);
  const [ocupado, setOcupado] = useState(false);
  const publicar = useToast();

  if (abierta !== base) {
    setBase(abierta);
    setValor(abierta);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-busy={ocupado}
      disabled={lectura || ocupado}
      onClick={() => {
        const siguiente = !valor;
        setValor(siguiente);
        setOcupado(true);
        void cambiarAbiertaAccion(slug, sucursalId, siguiente).then((resultado) => {
          setOcupado(false);
          if (!resultado.ok) {
            setValor(!siguiente);
            publicar("error", resultado.error);
            return;
          }
          publicar("exito", resultado.aviso);
        });
      }}
      className="inline-flex min-h-11 touch-manipulation items-center gap-3 text-sm font-medium disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 rounded-full ${valor ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform motion-reduce:transition-none dark:bg-zinc-950 ${valor ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
      {valor ? "Abierta" : "Cerrada"}
    </button>
  );
}
