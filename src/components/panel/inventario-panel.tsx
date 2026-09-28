"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ajustarAccion,
  importarAccion,
  minimoAccion,
  reponerAccion,
  transferirAccion,
} from "@/app/t/[slug]/inventario/actions";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { esStockBajo, type FilaInventario, type GrupoInventario } from "@/lib/inventario/reglas";

type Sucursal = { id: string; nombre: string };

export function InventarioPanel({
  slug,
  lectura,
  grupos,
  sucursales,
  exportarHref,
}: {
  slug: string;
  lectura: boolean;
  grupos: GrupoInventario[];
  sucursales: Sucursal[];
  exportarHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Importacion slug={slug} lectura={lectura} exportarHref={exportarHref} />
      {grupos.map((grupo) => (
        <section key={grupo.categoria} className="flex flex-col gap-3" aria-labelledby={`cat-${grupo.categoria}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`cat-${grupo.categoria}`} className="text-pretty text-base font-semibold">
              {grupo.categoria}
            </h3>
            {grupo.bajos > 0 ? (
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Stock bajo: {grupo.bajos}
              </p>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin stock bajo</p>
            )}
          </div>
          <div className="panel-scroll-x">
            <table className="panel-tabla min-w-[36rem]">
              <caption className="sr-only">{grupo.categoria}</caption>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Nivel</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.filas.map((fila) => (
                  <FilaStock
                    key={`${fila.productoId}-${fila.sucursalId}`}
                    slug={slug}
                    fila={fila}
                    lectura={lectura}
                    destinos={sucursales.filter((sucursal) => sucursal.id !== fila.sucursalId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Importacion({
  slug,
  lectura,
  exportarHref,
}: {
  slug: string;
  lectura: boolean;
  exportarHref: string;
}) {
  const publicar = useToast();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById("importar-stock") as HTMLFormElement);
    const resultado = await importarAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-base font-semibold">Archivo CSV</h3>
      <a
        href={exportarHref}
        className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline underline-offset-4"
      >
        Descargar inventario
      </a>
      {lectura ? null : (
        <form
          id="importar-stock"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            void run().then((hecho) => {
              if (hecho.omitida || !hecho.valor.ok) return;
              publicar("exito", hecho.valor.valor);
              event.currentTarget.reset();
            });
          }}
        >
          <Campo id="archivo-stock" etiqueta="Importar stock" ayuda="Columnas: sucursal, categoria, producto, stock y stock mínimo.">
            <input
              id="archivo-stock"
              name="archivo"
              type="file"
              accept=".csv,text/csv"
              required
              aria-describedby="archivo-stock-ayuda"
              className="block min-h-11 w-full text-sm"
            />
          </Campo>
          <Button type="submit" variant="secundario" loading={loading} loadingLabel="Importando…" success={success} error={error ?? false}>
            Importar
          </Button>
        </form>
      )}
    </div>
  );
}

function FilaStock({
  slug,
  fila,
  lectura,
  destinos,
}: {
  slug: string;
  fila: FilaInventario;
  lectura: boolean;
  destinos: Sucursal[];
}) {
  const clave = `${fila.productoId}-${fila.sucursalId}`;
  const bajo = esStockBajo(fila.stock, fila.stockMinimo);
  const agotado = fila.stock <= 0;

  return (
    <tr style={{ contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}>
      <th scope="row" className="align-top font-medium">
        <p className="break-words">{fila.nombre}</p>
        <p className="text-sm font-normal text-[var(--mu)]">{fila.sucursal}</p>
        {fila.disponible && fila.activo ? null : (
          <p className="text-sm font-normal">{fila.activo ? "No se ofrece en esta sucursal" : "Producto inactivo"}</p>
        )}
        <Link
          href={`/t/${slug}/inventario/${fila.productoId}?sucursal=${fila.sucursalId}`}
          className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium underline underline-offset-4"
        >
          Ver movimientos
        </Link>
      </th>
      <td className="align-top">
        <BarraNivel stock={fila.stock} minimo={fila.stockMinimo} />
        <span className="mt-2 flex flex-wrap gap-1">
          {agotado ? <Tag tono="danger">Agotado</Tag> : null}
          {bajo && !agotado ? <Tag tono="warn">Bajo</Tag> : null}
        </span>
      </td>
      <td className="align-top tabular-nums">
        <p>{fila.stock}</p>
        <p className="text-sm text-[var(--mu)]">Mínimo {fila.stockMinimo}</p>
      </td>
      <td className="align-top">
      {lectura ? <span className="text-sm text-[var(--mu)]">Solo lectura</span> : (
        <div className="flex min-w-56 flex-col gap-4">
          <FormularioSimple
            id={`reponer-${clave}`}
            etiqueta="Cantidad a reponer"
            nombre="cantidad"
            motivoId={`motivo-reponer-${clave}`}
            boton="Reponer"
            cargando="Reponiendo…"
            onSubmit={(datos) => reponerAccion(slug, datos)}
            ocultos={{ sucursalId: fila.sucursalId, productoId: fila.productoId }}
            minimo={1}
          />
          <FormularioSimple
            id={`ajuste-${clave}`}
            etiqueta="Stock contado"
            nombre="stock"
            motivoId={`motivo-ajuste-${clave}`}
            boton="Ajustar"
            cargando="Ajustando…"
            onSubmit={(datos) => ajustarAccion(slug, datos)}
            ocultos={{ sucursalId: fila.sucursalId, productoId: fila.productoId }}
            minimo={0}
          />
          <FormularioMinimo slug={slug} fila={fila} clave={clave} />
          {destinos.length > 0 ? <FormularioTransferencia slug={slug} fila={fila} destinos={destinos} clave={clave} /> : null}
        </div>
      )}
      </td>
    </tr>
  );
}

function BarraNivel({ stock, minimo }: { stock: number; minimo: number }) {
  const bajo = esStockBajo(stock, minimo);
  const tope = Math.max(minimo * 2, stock, 1);
  const escala = Math.min(1, stock / tope);
  return (
    <span className="barra-nivel" aria-hidden="true">
      <span
        className={bajo ? "barra-nivel-alerta" : "barra-nivel-ok"}
        style={{ transform: `scaleX(${escala})` }}
      />
    </span>
  );
}

function FormularioSimple({
  id,
  etiqueta,
  nombre,
  motivoId,
  boton,
  cargando,
  onSubmit,
  ocultos,
  minimo,
}: {
  id: string;
  etiqueta: string;
  nombre: string;
  motivoId: string;
  boton: string;
  cargando: string;
  onSubmit: (datos: FormData) => Promise<{ ok: true; aviso: string } | { ok: false; error: string }>;
  ocultos: Record<string, string>;
  minimo: number;
}) {
  const publicar = useToast();
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById(id) as HTMLFormElement);
    const resultado = await onSubmit(datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      id={id}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
        });
      }}
    >
      {Object.entries(ocultos).map(([clave, valor]) => (
        <input key={clave} type="hidden" name={clave} value={valor} />
      ))}
      <Campo id={`${id}-cantidad`} etiqueta={etiqueta}>
        <input
          id={`${id}-cantidad`}
          name={nombre}
          type="number"
          inputMode="numeric"
          min={minimo}
          step={1}
          required
          autoComplete="off"
          className={claseCampo}
        />
      </Campo>
      <Campo id={motivoId} etiqueta="Motivo">
        <input id={motivoId} name="motivo" required minLength={2} maxLength={200} autoComplete="off" className={claseCampo} />
      </Campo>
      <Button type="submit" variant="secundario" loading={loading} loadingLabel={cargando} success={success} error={error ?? false}>
        {boton}
      </Button>
    </form>
  );
}

function FormularioMinimo({ slug, fila, clave }: { slug: string; fila: FilaInventario; clave: string }) {
  const publicar = useToast();
  const id = `minimo-${clave}`;
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById(id) as HTMLFormElement);
    const resultado = await minimoAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      id={id}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
        });
      }}
    >
      <input type="hidden" name="sucursalId" value={fila.sucursalId} />
      <input type="hidden" name="productoId" value={fila.productoId} />
      <Campo id={`${id}-valor`} etiqueta="Stock mínimo">
        <input
          id={`${id}-valor`}
          name="minimo"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          defaultValue={fila.stockMinimo}
          autoComplete="off"
          className={claseCampo}
        />
      </Campo>
      <Button type="submit" variant="secundario" loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
        Guardar mínimo
      </Button>
    </form>
  );
}

function FormularioTransferencia({
  slug,
  fila,
  destinos,
  clave,
}: {
  slug: string;
  fila: FilaInventario;
  destinos: Sucursal[];
  clave: string;
}) {
  const publicar = useToast();
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState(destinos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("1");
  const nombreDestino = destinos.find((item) => item.id === destino)?.nombre ?? "la sucursal";
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData();
    datos.set("origenId", fila.sucursalId);
    datos.set("destinoId", destino);
    datos.set("productoId", fila.productoId);
    datos.set("cantidad", cantidad);
    const resultado = await transferirAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        setAbierto(true);
      }}
    >
      <Campo id={`destino-${clave}`} etiqueta="Sucursal de destino">
        <select
          id={`destino-${clave}`}
          value={destino}
          required
          onChange={(event) => setDestino(event.target.value)}
          className={claseCampo}
        >
          {destinos.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`cantidad-transfer-${clave}`} etiqueta="Cantidad a transferir">
        <input
          id={`cantidad-transfer-${clave}`}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={cantidad}
          autoComplete="off"
          onChange={(event) => setCantidad(event.target.value)}
          className={claseCampo}
        />
      </Campo>
      <Button type="submit" variant="secundario" success={success} error={error ?? false}>
        Transferir
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo="Transferir stock"
        descripcion={`Vas a mover ${cantidad} unidades de ${fila.nombre} desde ${fila.sucursal} hacia ${nombreDestino}.`}
        etiquetaConfirmar="Transferir"
        etiquetaCargando="Transfiriendo…"
        cargando={loading}
        error={error}
        alCerrar={() => {
          if (!loading) setAbierto(false);
        }}
        alConfirmar={() => {
          void run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setAbierto(false);
          });
        }}
      />
    </form>
  );
}
