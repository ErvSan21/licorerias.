"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { cambiarDeliveryAccion } from "@/app/t/[slug]/actions";
import { eliminarTarifaAccion, guardarTarifaAccion } from "@/app/t/[slug]/envio/actions";
import { Interruptor } from "@/components/panel/ajustes-sucursales";
import { UbicacionSucursal } from "@/components/panel/ubicacion-sucursal";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";
import type { TarifaLista } from "@/lib/envio/servicio";

type Sucursal = { id: string; nombre: string; lat: number | null; lng: number | null; aceptaDelivery: boolean };

export function EnvioPanel({
  slug,
  lectura,
  tarifas,
  sucursales,
  sucursalFija,
}: {
  slug: string;
  lectura: boolean;
  tarifas: TarifaLista[];
  sucursales: Sucursal[];
  sucursalFija: string | null;
}) {
  const sucursalId = sucursalFija ?? sucursales[0]?.id ?? "";
  // Con una sucursal elegida, los formularios no preguntan cuál.
  const opciones = sucursalFija ? sucursales.filter((sucursal) => sucursal.id === sucursalFija) : sucursales;
  const [nueva, setNueva] = useState(false);
  const ordenadas = tarifas.toSorted((a, b) => a.sucursal.localeCompare(b.sucursal, "es") || a.hastaKm - b.hastaKm);
  const variasSucursales = new Set(tarifas.map((tarifa) => tarifa.sucursalId)).size > 1;

  return (
    <div className="flex flex-col gap-4">
      {opciones.map((sucursal) => (
        <InterruptorDelivery
          key={sucursal.id}
          slug={slug}
          sucursal={sucursal}
          conNombre={opciones.length > 1}
          lectura={lectura}
        />
      ))}

      <section className="dashboard-tarjeta" aria-labelledby="ubicacion-envio">
        <h3 id="ubicacion-envio">Ubicación de la sucursal</h3>
        <p className="mb-3 text-sm text-[var(--mu)]">
          Desde aquí se mide la distancia hasta el cliente para calcular el costo del envío.
        </p>
        <UbicacionSucursal slug={slug} sucursales={opciones} sucursalId={sucursalId} lectura={lectura} />
      </section>

      <section className="dashboard-tarjeta" aria-labelledby="tarifas-envio">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="tarifas-envio" className="!mb-0">
            Tarifas por distancia
          </h3>
          {lectura ? null : (
            <Button type="button" size="sm" onClick={() => setNueva(true)}>
              + Agregar
            </Button>
          )}
        </div>
        <p className="mb-3 text-sm text-[var(--mu)]">Se usa el primer rango que cubre la distancia por calle.</p>
        {ordenadas.length === 0 ? (
          <p className="text-sm text-[var(--mu)]">Todavía no hay tarifas. Sin tarifas no se puede calcular el envío.</p>
        ) : (
          <ul className="stock-lista">
            {ordenadas.map((tarifa) => (
              <li key={tarifa.id} className="stock-fila">
                <FilaTarifa
                  slug={slug}
                  tarifa={tarifa}
                  lectura={lectura}
                  sucursales={opciones}
                  mostrarSucursal={variasSucursales}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer abierto={nueva} titulo="Nueva tarifa" alCerrar={() => setNueva(false)}>
        {nueva ? (
          <FormularioTarifa slug={slug} sucursales={opciones} sucursalId={sucursalId} tarifa={null} alCerrar={() => setNueva(false)} />
        ) : null}
      </Drawer>
    </div>
  );
}

function FilaTarifa({
  slug,
  tarifa,
  lectura,
  sucursales,
  mostrarSucursal,
}: {
  slug: string;
  tarifa: TarifaLista;
  lectura: boolean;
  sucursales: Sucursal[];
  mostrarSucursal: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const publicar = useToast();
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await eliminarTarifaAccion(slug, tarifa.id, tarifa.sucursalId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-semibold tabular-nums">Hasta {tarifa.hastaKm} km</p>
        {mostrarSucursal ? <p className="text-xs text-[var(--mu)]">{tarifa.sucursal}</p> : null}
      </div>
      <b className="shrink-0 font-display text-[17px] font-extrabold tabular-nums">{formatoBs(tarifa.costo)}</b>
      {lectura ? null : (
        <AccionesFila alEditar={() => setEditando(true)} alEliminar={() => setConfirmar(true)} nombre={`${tarifa.hastaKm} km`} />
      )}
      <Drawer abierto={editando} titulo="Editar tarifa" alCerrar={() => setEditando(false)}>
        {editando ? (
          <FormularioTarifa
            slug={slug}
            sucursales={sucursales}
            sucursalId={tarifa.sucursalId}
            tarifa={tarifa}
            alCerrar={() => setEditando(false)}
          />
        ) : null}
      </Drawer>
      <ConfirmDialog
        abierto={confirmar}
        titulo="Eliminar tarifa"
        descripcion={`Se quita el rango de ${tarifa.hastaKm} km.`}
        etiquetaConfirmar="Eliminar"
        peligro
        cargando={loading}
        error={error}
        alCerrar={() => setConfirmar(false)}
        alConfirmar={() => {
          void run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setConfirmar(false);
          });
        }}
      />
    </>
  );
}

function AccionesFila({ alEditar, alEliminar, nombre }: { alEditar: () => void; alEliminar: () => void; nombre: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="envio-accion" aria-label={`Editar ${nombre}`} onClick={alEditar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          <path d="M13 7l4 4" />
        </svg>
      </button>
      <button type="button" className="envio-accion envio-accion-peligro" aria-label={`Eliminar ${nombre}`} onClick={alEliminar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 7h14" />
          <path d="M9 7V4h6v3" />
          <path d="M7 7l1 13h8l1-13" />
        </svg>
      </button>
    </div>
  );
}

/** Con una sola sucursal posible, va oculta: la pantalla ya dice cuál es. */
function SelectorSucursal({ id, sucursales, sucursalId }: { id: string; sucursales: Sucursal[]; sucursalId: string }) {
  if (sucursales.length <= 1) {
    return <input type="hidden" name="sucursalId" value={sucursales[0]?.id ?? sucursalId} />;
  }
  return (
    <Campo id={id} etiqueta="Sucursal">
      <select id={id} name="sucursalId" required defaultValue={sucursalId} className={claseCampo}>
        {sucursales.map((sucursal) => (
          <option key={sucursal.id} value={sucursal.id}>
            {sucursal.nombre}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function FormularioTarifa({
  slug,
  sucursales,
  sucursalId,
  tarifa,
  alCerrar,
}: {
  slug: string;
  sucursales: Sucursal[];
  sucursalId: string;
  tarifa: TarifaLista | null;
  alCerrar?: () => void;
}) {
  const publicar = useToast();
  const idForm = tarifa ? `tarifa-${tarifa.id}` : "tarifa-nueva";
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById(idForm) as HTMLFormElement);
    const resultado = await guardarTarifaAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  return (
    <form
      id={idForm}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.reportValidity()) return;
        void run().then((hecho) => {
          if (hecho.omitida || !hecho.valor.ok) return;
          publicar("exito", hecho.valor.valor);
          if (!tarifa) event.currentTarget.reset();
          alCerrar?.();
        });
      }}
    >
      {tarifa ? <input type="hidden" name="id" value={tarifa.id} /> : null}
      <SelectorSucursal id={`${idForm}-sucursal`} sucursales={sucursales} sucursalId={sucursalId} />
      <Campo id={`${idForm}-km`} etiqueta="Hasta (km)" ayuda="Sin repetir el mismo tope en la sucursal.">
        <input
          id={`${idForm}-km`}
          name="hastaKm"
          inputMode="decimal"
          autoComplete="off"
          required
          aria-describedby={`${idForm}-km-ayuda`}
          defaultValue={tarifa ? String(tarifa.hastaKm) : ""}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <Campo id={`${idForm}-costo`} etiqueta="Costo">
        <input
          id={`${idForm}-costo`}
          name="costo"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={tarifa ? String(tarifa.costo) : ""}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
          Guardar tarifa
        </Button>
        {alCerrar ? (
          <Button type="button" variant="fantasma" onClick={alCerrar}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function InterruptorDelivery({
  slug,
  sucursal,
  conNombre,
  lectura,
}: {
  slug: string;
  sucursal: Sucursal;
  conNombre: boolean;
  lectura: boolean;
}) {
  const router = useRouter();
  const publicar = useToast();
  const [ocupado, setOcupado] = useState(false);
  const sinUbicacion = sucursal.lat == null || sucursal.lng == null;

  return (
    <section className="dashboard-tarjeta">
      <Interruptor
        titulo={conNombre ? `Delivery · ${sucursal.nombre}` : "Delivery"}
        descripcion={
          sinUbicacion && !sucursal.aceptaDelivery
            ? "Guarda primero la ubicación de la sucursal para activarlo."
            : "Permite vender con envío a domicilio, en el panel y en la tienda en línea."
        }
        activo={sucursal.aceptaDelivery}
        deshabilitado={lectura || ocupado || (sinUbicacion && !sucursal.aceptaDelivery)}
        alCambiar={() => {
          setOcupado(true);
          void cambiarDeliveryAccion(slug, sucursal.id, !sucursal.aceptaDelivery).then((resultado) => {
            setOcupado(false);
            if (!resultado.ok) {
              publicar("error", resultado.error);
              return;
            }
            publicar("exito", resultado.aviso);
            router.refresh();
          });
        }}
      />
    </section>
  );
}
