"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

import { activarBoton } from "@/components/ui/async-guard";
import { Spinner } from "@/components/ui/spinner";
import { cx, exitoMs } from "@/components/ui/tokens";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";
type Tamano = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "ui-boton-primario bg-[var(--color-primario)] text-[var(--color-sobre-primario)]",
  secundario:
    "border border-zinc-300 bg-transparent text-zinc-900 dark:border-zinc-700 dark:text-zinc-100",
  peligro: "bg-red-700 text-white dark:bg-red-500 dark:text-zinc-950",
  fantasma: "bg-transparent text-zinc-900 dark:text-zinc-100",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-base",
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  success?: boolean;
  error?: boolean | string;
  variant?: Variante;
  size?: Tamano;
  icon?: ReactNode;
};

export function Button({
  children,
  loading,
  loadingLabel = "Cargando…",
  success = false,
  error = false,
  variant = "primario",
  size = "md",
  icon,
  className,
  type = "button",
  disabled,
  onClick,
  ...resto
}: Props) {
  const errorId = useId();
  const estadoId = useId();
  const bloqueoRef = useRef(false);
  const [bloqueo, setBloqueo] = useState(false);
  const [cargaVista, setCargaVista] = useState(false);
  const [firmaExito, setFirmaExito] = useState(success);
  const [exitoTerminado, setExitoTerminado] = useState(false);

  if (loading && !cargaVista) setCargaVista(true);
  if (!loading && cargaVista) {
    setCargaVista(false);
    if (bloqueo) setBloqueo(false);
  }
  if (success !== firmaExito) {
    setFirmaExito(success);
    setExitoTerminado(false);
  }

  const ocupado = Boolean(loading) || bloqueo;
  const mensaje = typeof error === "string" ? error : null;
  const hayError = Boolean(error);
  const muestraCheck = success && !ocupado && !exitoTerminado;
  const cargaRef = useRef(Boolean(loading));

  useEffect(() => {
    cargaRef.current = Boolean(loading);
  }, [loading]);

  useEffect(() => {
    if (bloqueo || loading) return;
    bloqueoRef.current = false;
  }, [bloqueo, loading]);

  useEffect(() => {
    if (!muestraCheck) return;
    const timer = setTimeout(() => setExitoTerminado(true), exitoMs);
    return () => clearTimeout(timer);
  }, [muestraCheck]);
  const muestraCarga = ocupado && !muestraCheck;

  return (
    <span className={cx("inline-flex max-w-full flex-col items-stretch gap-1", className)}>
      <button
        {...resto}
        type={type}
        disabled={Boolean(disabled)}
        aria-disabled={Boolean(disabled) || ocupado || undefined}
        aria-describedby={mensaje ? errorId : undefined}
        aria-labelledby={muestraCheck ? estadoId : undefined}
        className={cx(
          "ui-boton ui-movimiento inline-flex w-full touch-manipulation items-center justify-center rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          VARIANTES[variant],
          TAMANOS[size],
          hayError && !ocupado && "ui-sacudir",
          hayError && "ring-2 ring-red-700 ring-offset-2 ring-offset-white dark:ring-red-400 dark:ring-offset-zinc-950",
        )}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (type === "submit" && form && !form.checkValidity()) {
            onClick?.(event);
            return;
          }
          const controlaCarga = loading !== undefined || type === "submit";
          const permitido = activarBoton(
            { loading: Boolean(loading) || bloqueoRef.current, disabled: Boolean(disabled) },
            () => {
              if (!controlaCarga) return;
              bloqueoRef.current = true;
              // En un submit, deshabilitar el botón dentro del clic cancela el
              // envío y useFormStatus no vuelve a false: el login se queda en
              // «Entrando…». El candado visual lo pone `loading`.
              if (type !== "submit") setBloqueo(true);
            },
          );
          if (!permitido) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
          if (type === "submit") {
            window.setTimeout(() => {
              if (!cargaRef.current) bloqueoRef.current = false;
            }, 400);
          }
        }}
      >
        <span className="inline-grid items-center justify-items-center">
          <span
            className={cx(
              "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap",
              (muestraCarga || muestraCheck) && "invisible",
            )}
          >
            {icon ? (
              <span aria-hidden="true" className="inline-flex">
                {icon}
              </span>
            ) : null}
            {children}
          </span>
          <span
            className={cx(
              "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap",
              !muestraCarga && "invisible",
            )}
          >
            <Spinner size="sm" className="text-current" />
            {loadingLabel}
          </span>
          {muestraCheck ? (
            <span className="col-start-1 row-start-1 inline-flex" aria-hidden="true">
              <svg className="ui-check ui-movimiento" viewBox="0 0 24 24">
                <path
                  d="M5 12.5 10 17.5 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
        </span>
      </button>
      <span id={estadoId} className="sr-only" role="status" aria-live="polite">
        {muestraCarga ? loadingLabel : muestraCheck ? "Listo" : ""}
      </span>
      {mensaje ? (
        <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {mensaje}
        </p>
      ) : null}
    </span>
  );
}
