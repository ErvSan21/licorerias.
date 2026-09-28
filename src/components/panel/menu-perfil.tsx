"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { salir } from "@/app/login/actions";
import { elegirSucursalAccion } from "@/app/t/[slug]/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Drawer } from "@/components/ui/drawer";

export type SucursalMenu = {
  id: string;
  nombre: string;
  central: boolean;
};

export function MenuPerfilTienda({
  correo,
  slug,
  sucursales,
  seleccion,
}: {
  correo: string;
  slug: string;
  sucursales: SucursalMenu[];
  seleccion: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [sucursalAbierta, setSucursalAbierta] = useState(false);
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

  function abrirSucursal() {
    setAbierto(false);
    setSucursalAbierta(true);
  }

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
          className="absolute right-0 top-12 z-50 min-w-52 overflow-hidden rounded-xl border border-[var(--ln)] bg-[var(--sf)] py-1 shadow-lg"
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
          <button
            type="button"
            role="menuitem"
            className="flex min-h-10 w-full items-center px-3 text-left text-sm"
            onClick={abrirSucursal}
          >
            Cambiar de sucursal
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
      <Drawer abierto={sucursalAbierta} titulo="Cambiar de sucursal" alCerrar={() => setSucursalAbierta(false)}>
        <HojaSucursal
          slug={slug}
          sucursales={sucursales}
          seleccion={seleccion}
          alCerrar={() => setSucursalAbierta(false)}
        />
      </Drawer>
    </div>
  );
}

function HojaSucursal({
  slug,
  sucursales,
  seleccion,
  alCerrar,
}: {
  slug: string;
  sucursales: SucursalMenu[];
  seleccion: string | null;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const inicial = seleccion ?? sucursales[0]?.id ?? "";
  const [elegida, setElegida] = useState(inicial);
  const [pendiente, iniciar] = useTransition();

  if (sucursales.length === 0) {
    return (
      <>
        <p className="text-sm leading-6">Todavía no hay sucursales.</p>
        <PieHoja alCancelar={alCerrar} deshabilitado />
      </>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const datos = new FormData();
        datos.set("slug", slug);
        datos.set("sucursal", elegida);
        iniciar(async () => {
          await elegirSucursalAccion(datos);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <div role="radiogroup" aria-label="Sucursal" className="flex flex-col gap-1">
        {sucursales.map((sucursal) => {
          const activa = elegida === sucursal.id;
          const titulo = sucursal.central ? "La central" : sucursal.nombre;
          const detalle =
            sucursal.central && sucursal.nombre.trim().toLocaleLowerCase("es") !== "la central" ? sucursal.nombre : null;
          return (
            <button
              key={sucursal.id}
              type="button"
              role="radio"
              aria-checked={activa}
              className={activa ? "ui-item-menu ui-item-menu-activo w-full" : "ui-item-menu w-full"}
              onClick={() => setElegida(sucursal.id)}
            >
              <span className="flex min-w-0 flex-col py-1 text-left">
                <span>{titulo}</span>
                {detalle ? <span className="text-sm font-normal opacity-80">{detalle}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <PieHoja alCancelar={alCerrar} cargando={pendiente} deshabilitado={!elegida} />
    </form>
  );
}
