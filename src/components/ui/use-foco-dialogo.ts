"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocoDialogo(
  activo: boolean,
  contenedor: RefObject<HTMLElement | null>,
  alCerrar: () => void,
  bloquearCierre: boolean,
) {
  const cerrar = useEffectEvent(() => {
    if (!bloquearCierre) alCerrar();
  });

  useEffect(() => {
    if (!activo) return;
    const nodo = contenedor.current;
    if (!nodo) return;

    const previo = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const preferido =
      nodo.querySelector<HTMLElement>("[data-autofocus]") ??
      nodo.querySelector<HTMLElement>("button:not([disabled])");
    (preferido ?? nodo).focus();

    function alTeclado(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar();
        return;
      }
      if (event.key !== "Tab" || !nodo) return;

      const lista = [...nodo.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        (elemento) => !elemento.hasAttribute("disabled"),
      );
      if (lista.length === 0) {
        event.preventDefault();
        return;
      }

      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const actual = document.activeElement;
      if (event.shiftKey && (actual === primero || !nodo.contains(actual))) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && actual === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflow;
      if (previo instanceof HTMLElement) previo.focus();
    };
  }, [activo, contenedor]);
}
