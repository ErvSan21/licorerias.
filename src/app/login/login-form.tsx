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
          className="h-12 w-full rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 text-base text-[var(--campo-tx)]"
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
          className="h-12 w-full rounded-lg border border-[var(--campo-ln)] bg-[var(--campo-bg)] px-3 text-base text-[var(--campo-tx)]"
        />
      </div>
      {estado.error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {estado.error}
        </p>
      ) : null}
      <BotonPendiente idle="Entrar" pending="Entrando…" />
    </form>
  );
}
