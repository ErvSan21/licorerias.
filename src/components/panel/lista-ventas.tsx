"use client";

import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import { Card } from "@/components/ui/card";

export type ProductoVenta = {
  id: string;
  nombre: string;
  precio: string;
};

export function ListaVentas({ productos }: { productos: ProductoVenta[] }) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  if (productos.length === 0) {
    return <EmptyState titulo="No hay productos en esta sucursal" descripcion="Cuando se ofrezcan aquí, aparecen en la lista." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {productos.map((producto) => (
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
  );
}
