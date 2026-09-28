"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  nombreSecreto?: string;
};

export function CampoContrasena({ className, nombreSecreto = "contraseña", ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className ? `${className} pr-12` : "pr-12"}
      />
      <button
        type="button"
        className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 dark:text-zinc-300"
        aria-label={visible ? `Ocultar ${nombreSecreto}` : `Mostrar ${nombreSecreto}`}
        aria-pressed={visible}
        onClick={() => setVisible((actual) => !actual)}
      >
        {visible ? <OjoCerrado /> : <OjoAbierto />}
      </button>
    </div>
  );
}

function OjoAbierto() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OjoCerrado() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.8" />
      <path d="M6.1 6.8C3.5 8.6 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
