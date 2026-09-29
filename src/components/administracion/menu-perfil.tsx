"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { salir } from "@/app/login/actions";
export function MenuPerfil() {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!abierto) return;
    function fuera(event: PointerEvent) {
      if (!raiz.current?.contains(event.target as Node)) setAbierto(false);
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        className="panel-tema"
        aria-label="Perfil"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={menuId}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3" />
          <path d="M6 19c.8-2.8 3-4.2 6-4.2s5.2 1.4 6 4.2" strokeLinecap="round" />
        </svg>
      </button>
      {abierto ? (
        <div
          id={menuId}
          role="menu"
          className="producto-menu ui-movimiento"
        >
          <Link
            href="/administracion/perfil"
            role="menuitem"
            className="text-sm"
            onClick={() => setAbierto(false)}
          >
            Mi perfil
          </Link>
          <form action={salir}>
            <button type="submit" role="menuitem" className="text-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
