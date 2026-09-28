"use client";

import { Dialogo } from "@/components/ui/dialogo";

export function Modal({
  abierto,
  titulo,
  descripcion,
  alCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  alCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialogo abierto={abierto} titulo={titulo} descripcion={descripcion} alCerrar={alCerrar} alineacion="centro">
      {children}
    </Dialogo>
  );
}
