"use client";

import { useState } from "react";

import { claseCampo } from "@/components/super/campo";
import { Card } from "@/components/ui/card";
import { ChipCategoria } from "@/components/ui/chip-categoria";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import { TIPOS_BEBIDA, tipoDeBebida, type TipoBebida } from "@/lib/catalogo/tipo-bebida";

export type ProductoVenta = {
  id: string;
  nombre: string;
  precio: string;
};

export function ListaVentas({ productos }: { productos: ProductoVenta[] }) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoBebida>("Todos");
  const texto = busqueda.trim().toLocaleLowerCase("es");
  const visibles = productos.filter((producto) => {
    if (tipo !== "Todos" && tipoDeBebida(producto.nombre) !== tipo) return false;
    if (!texto) return true;
    return producto.nombre.toLocaleLowerCase("es").includes(texto);
  });

  if (productos.length === 0) {
    return <EmptyState titulo="No hay productos en esta sucursal" descripcion="Cuando se ofrezcan aquí, aparecen en la lista." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        name="q"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Buscar producto"
        aria-label="Buscar producto"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        className={claseCampo}
      />
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Tipos de bebida">
        {TIPOS_BEBIDA.map((nombre) => (
          <ChipCategoria key={nombre} activo={tipo === nombre} onClick={() => setTipo(nombre)}>
            {nombre}
          </ChipCategoria>
        ))}
      </div>
      {visibles.length === 0 ? (
        <EmptyState titulo="No hay productos" descripcion="Prueba otro tipo o otro nombre." />
      ) : (
    <ul className="flex flex-col gap-3">
      {visibles.map((producto) => (
        <li key={producto.id}>
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="break-words font-semibold">{producto.nombre}</p>
              <p className="text-sm tabular-nums text-[var(--mu)]">{producto.precio}</p>
            </div>
            <SelectorCantidad
              valor={cantidades[producto.id] ?? 0}
              onChange={(valor) => setCantidades((prev) => ({ ...prev, [producto.id]: valor }))}
              etiqueta={`Cantidad de ${producto.nombre}`}
            />
          </Card>
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}
