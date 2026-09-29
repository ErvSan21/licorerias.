"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarOfertaAccion } from "@/app/t/[slug]/ofertas/actions";
import { PieHoja } from "@/components/administracion/pie-hoja";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";
import { campoFechaBolivia, etiquetaEstado, type EstadoOferta } from "@/lib/ofertas/reglas";

export type OfertaFila = {
  id: string;
  producto: string;
  precioAntes: number;
  precioOferta: number;
  inicio: string;
  fin: string;
  estado: EstadoOferta;
};

export type ProductoOferta = { id: string; nombre: string; precio: number };

const TONO: Record<EstadoOferta, "ok" | "brand" | "neutro" | "warn"> = {
  vigente: "ok",
  programada: "brand",
  vencida: "neutro",
  inactiva: "warn",
};

const fechaCorta = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function OfertasLista({
  slug,
  sucursal,
  ofertas,
  productos,
  puedeCrear,
}: {
  slug: string;
  sucursal: { id: string; nombre: string };
  ofertas: OfertaFila[];
  productos: ProductoOferta[];
  puedeCrear: boolean;
}) {
  const [crear, setCrear] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-pretty text-lg font-semibold">Ofertas · {sucursal.nombre}</h2>
        {puedeCrear ? (
          <Button type="button" size="sm" onClick={() => setCrear(true)}>
            + Crear oferta
          </Button>
        ) : null}
      </div>

      {ofertas.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay ofertas"
          descripcion={puedeCrear ? "Crea una con el botón de arriba." : "Cuando haya ofertas en esta sucursal, aparecen aquí."}
        />
      ) : (
        <ul className="stock-lista">
          {ofertas.map((oferta) => {
            const descuento =
              oferta.precioAntes > 0 ? Math.round((1 - oferta.precioOferta / oferta.precioAntes) * 100) : 0;
            return (
              <li key={oferta.id} className={`stock-fila ${oferta.estado === "vigente" ? "" : "opacity-70"}`}>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{oferta.producto}</p>
                  <p className="text-xs text-[var(--mu)]">
                    <time dateTime={oferta.inicio}>{fechaCorta.format(new Date(oferta.inicio))}</time> →{" "}
                    <time dateTime={oferta.fin}>{fechaCorta.format(new Date(oferta.fin))}</time>
                  </p>
                  <div className="mt-1">
                    <Tag tono={TONO[oferta.estado]}>{etiquetaEstado(oferta.estado)}</Tag>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <s className="text-sm tabular-nums text-[var(--mu)]">{formatoBs(oferta.precioAntes)}</s>
                  <b className="font-display text-[17px] font-extrabold tabular-nums">{formatoBs(oferta.precioOferta)}</b>
                  {descuento > 0 ? <span className="text-xs font-semibold text-[var(--ok)]">−{descuento}%</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Drawer abierto={crear} titulo="Nueva oferta" descripcion={sucursal.nombre} alCerrar={() => setCrear(false)}>
        {crear ? (
          <FormularioOferta slug={slug} sucursalId={sucursal.id} productos={productos} alCerrar={() => setCrear(false)} />
        ) : null}
      </Drawer>
    </div>
  );
}

function FormularioOferta({
  slug,
  sucursalId,
  productos,
  alCerrar,
}: {
  slug: string;
  sucursalId: string;
  productos: ProductoOferta[];
  alCerrar: () => void;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [inicio, setInicio] = useState(() => campoFechaBolivia(new Date().toISOString()));
  const [fin, setFin] = useState(() => campoFechaBolivia(new Date(Date.now() + 7 * 86_400_000).toISOString()));
  const producto = productos.find((item) => item.id === productoId);
  const nuevo = Number(precio);
  const valido = precio !== "" && Number.isFinite(nuevo) && producto != null;
  const { run, loading, error } = useAsyncAction(async () => {
    const datos = new FormData();
    datos.set("tipo", "precio_fijo");
    datos.set("productoId", productoId);
    datos.set("sucursalId", sucursalId);
    datos.set("valor", precio);
    datos.set("inicio", inicio);
    datos.set("fin", fin);
    datos.set("activa", "on");
    const resultado = await guardarOfertaAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  if (productos.length === 0) {
    return (
      <>
        <p className="text-sm leading-6">No hay productos activos en esta sucursal.</p>
        <PieHoja alCancelar={alCerrar} deshabilitado />
      </>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          alCerrar();
          router.refresh();
        });
      }}
    >
      <Campo id="oferta-producto" etiqueta="Producto">
        <select
          id="oferta-producto"
          required
          value={productoId}
          onChange={(event) => setProductoId(event.target.value)}
          className={claseCampo}
        >
          {productos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre} · {formatoBs(item.precio)}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="oferta-precio" etiqueta="Precio de oferta (Bs)">
        <input
          id="oferta-precio"
          type="number"
          inputMode="decimal"
          required
          min={0}
          max={producto ? Math.max(0, producto.precio - 0.01) : undefined}
          step="0.01"
          autoComplete="off"
          value={precio}
          onChange={(event) => setPrecio(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      {valido && producto ? (
        <p className="text-sm">
          <s className="tabular-nums text-[var(--mu)]">{formatoBs(producto.precio)}</s>{" "}
          <b className="tabular-nums">{formatoBs(nuevo)}</b>
          {producto.precio > 0 && nuevo < producto.precio ? (
            <span className="text-[var(--ok)]"> · −{Math.round((1 - nuevo / producto.precio) * 100)}%</span>
          ) : null}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo id="oferta-inicio" etiqueta="Fecha de inicio">
          <input
            id="oferta-inicio"
            type="datetime-local"
            required
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
            className={claseCampo}
          />
        </Campo>
        <Campo id="oferta-fin" etiqueta="Fecha de fin">
          <input
            id="oferta-fin"
            type="datetime-local"
            required
            min={inicio}
            value={fin}
            onChange={(event) => setFin(event.target.value)}
            className={claseCampo}
          />
        </Campo>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--er)]">
          {error}
        </p>
      ) : null}
      <PieHoja alCancelar={alCerrar} cargando={loading} etiquetaCargando="Creando…" />
    </form>
  );
}
