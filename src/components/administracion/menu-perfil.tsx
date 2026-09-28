"use client";

import { useEffect, useId, useRef, useState } from "react";

import { salir } from "@/app/login/actions";
import { Drawer } from "@/components/ui/drawer";

export function MenuPerfil({ correo }: { correo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [perfil, setPerfil] = useState(false);
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
          className="absolute right-0 top-12 z-50 min-w-44 overflow-hidden rounded-xl border border-[var(--ln)] bg-[var(--sf)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-10 w-full items-center px-3 text-left text-sm"
            onClick={() => {
              setAbierto(false);
              setPerfil(true);
            }}
          >
            Perfil
          </button>
          <form action={salir}>
            <button type="submit" role="menuitem" className="flex min-h-10 w-full items-center px-3 text-left text-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
      <Drawer abierto={perfil} titulo="Perfil" alCerrar={() => setPerfil(false)}>
        <p className="text-sm text-[var(--mu)]">Correo</p>
        <p className="mt-1 break-all font-medium">{correo || "Sin correo"}</p>
      </Drawer>
    </div>
  );
}
