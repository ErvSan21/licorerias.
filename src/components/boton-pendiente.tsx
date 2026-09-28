"use client";

import { useFormStatus } from "react-dom";

export function BotonPendiente({
  idle,
  pending,
  variant = "solido",
}: {
  idle: string;
  pending: string;
  variant?: "solido" | "contorno";
}) {
  const { pending: ocupado } = useFormStatus();
  const clase =
    variant === "contorno"
      ? "border border-zinc-300 bg-transparent text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";

  return (
    <button
      type="submit"
      disabled={ocupado}
      aria-disabled={ocupado}
      className={`h-12 w-full rounded-lg text-base font-medium disabled:cursor-wait disabled:opacity-60 ${clase}`}
    >
      {ocupado ? pending : idle}
    </button>
  );
}
