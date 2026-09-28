"use client";

import { useActionState } from "react";

import { entrar, type EstadoLogin } from "@/app/login/actions";
import { BotonPendiente } from "@/components/boton-pendiente";
import { CampoContrasena } from "@/components/ui/campo-contrasena";

const inicial: EstadoLogin = { error: null };

export function LoginForm({ siguiente }: { siguiente: string | null }) {
  const [estado, accion] = useActionState(entrar, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      {siguiente ? <input type="hidden" name="siguiente" value={siguiente} /> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <CampoContrasena
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      {estado.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      ) : null}
      <BotonPendiente idle="Entrar" pending="Entrando…" />
    </form>
  );
}
