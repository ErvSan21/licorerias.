import type { ReactNode } from "react";

import { formatoBs } from "@/lib/catalogo/reglas";
import { diasSemana, type Reporte } from "@/lib/reportes/reglas";

export function GraficosReporte({ reporte }: { reporte: Reporte }) {
  return (
    <div className="grid gap-4">
      <Bloque titulo="Por sucursal">
        <Barras
          filas={reporte.sucursales.map((sucursal) => ({
            etiqueta: sucursal.nombre,
            valor: sucursal.ventas,
            texto: formatoBs(sucursal.ventas),
          }))}
        />
      </Bloque>
      <Bloque titulo="Por categoría">
        <Barras
          filas={reporte.categorias.map((categoria) => ({
            etiqueta: categoria.nombre,
            valor: categoria.ventas,
            texto: formatoBs(categoria.ventas),
          }))}
        />
      </Bloque>
      <Bloque titulo="Productos">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Más vendido: {reporte.masVendido ? `${reporte.masVendido.nombre} · ${reporte.masVendido.unidades}` : "ninguno"}
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Menos vendido: {reporte.menosVendido ? `${reporte.menosVendido.nombre} · ${reporte.menosVendido.unidades}` : "ninguno"}
        </p>
        <Barras
          filas={reporte.productos.slice(0, 8).map((producto) => ({
            etiqueta: producto.nombre,
            valor: producto.unidades,
            texto: String(producto.unidades),
          }))}
        />
      </Bloque>
      <Bloque titulo="Entrega">
        <Barras
          filas={reporte.entregas.map((entrega) => ({
            etiqueta: entrega.tipo === "delivery" ? "Delivery" : "Recojo",
            valor: entrega.pedidos,
            texto: String(entrega.pedidos),
          }))}
        />
      </Bloque>
      <Bloque titulo="Día">
        <Barras
          filas={reporte.dias.map((dia) => ({
            etiqueta: diasSemana[dia.dia] ?? "",
            valor: dia.pedidos,
            texto: String(dia.pedidos),
          }))}
        />
      </Bloque>
      <Bloque titulo="Hora">
        <Barras
          filas={reporte.horas.map((hora) => ({
            etiqueta: `${String(hora.hora).padStart(2, "0")} h`,
            valor: hora.pedidos,
            texto: String(hora.pedidos),
          }))}
        />
      </Bloque>
      <Bloque titulo="Origen del precio">
        <Barras
          filas={reporte.origenes.map((origen) => ({
            etiqueta: origen.origen === "central" ? "Central" : origen.origen === "propio" ? "Propio" : "Oferta",
            valor: origen.ventas,
            texto: formatoBs(origen.ventas),
          }))}
        />
      </Bloque>
      <Bloque titulo="Personal">
        <Barras
          filas={reporte.personal.map((persona) => ({
            etiqueta: persona.usuario,
            valor: persona.cambios,
            texto: String(persona.cambios),
          }))}
        />
      </Bloque>
      <Bloque titulo="Inventario">
        <Barras
          filas={reporte.inventario.map((sucursal) => ({
            etiqueta: sucursal.nombre,
            valor: sucursal.valor,
            texto: formatoBs(sucursal.valor),
          }))}
        />
      </Bloque>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-pretty text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Barras({ filas }: { filas: { etiqueta: string; valor: number; texto: string }[] }) {
  const maximo = filas.reduce((mayor, fila) => Math.max(mayor, fila.valor), 0);
  if (filas.length === 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin datos.</p>;
  return (
    <div className="flex flex-col gap-2">
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
          <span className="min-w-0 truncate">{fila.etiqueta}</span>
          <span className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <span
              className="block h-full origin-left rounded-full bg-[var(--color-primario)]"
              style={{ transform: `scaleX(${maximo > 0 ? fila.valor / maximo : 0})` }}
            />
          </span>
          <span className="tabular-nums">{fila.texto}</span>
        </div>
      ))}
    </div>
  );
}
