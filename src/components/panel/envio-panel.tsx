"use client";

import { useState } from "react";

import {
  eliminarTarifaAccion,
  eliminarZonaAccion,
  guardarTarifaAccion,
  guardarZonaAccion,
} from "@/app/t/[slug]/envio/actions";
import { MapaCliente } from "@/components/panel/mapa-cliente";
import { Campo, claseCampo } from "@/components/super/campo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineLoader } from "@/components/ui/inline-loader";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs } from "@/lib/catalogo/reglas";
import type { TarifaLista, ZonaLista } from "@/lib/envio/servicio";

type Sucursal = { id: string; nombre: string; lat: number | null; lng: number | null };

export function EnvioPanel({
  slug,
  lectura,
  tarifas,
  zonas,
  sucursales,
  sucursalFija,
}: {
  slug: string;
  lectura: boolean;
  tarifas: TarifaLista[];
  zonas: ZonaLista[];
  sucursales: Sucursal[];
  sucursalFija: string | null;
}) {
  const sucursalId = sucursalFija ?? sucursales[0]?.id ?? "";
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="tarifas-envio">
        <h3 id="tarifas-envio" className="text-pretty text-base font-semibold">
          Tarifas de envío
        </h3>
        {lectura ? null : (
          <FormularioTarifa slug={slug} sucursales={sucursales} sucursalId={sucursalId} tarifa={null} />
        )}
        {tarifas.length === 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Todavía no hay rangos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tarifas.map((tarifa) => (
              <li key={tarifa.id} className="[content-visibility:auto]">
                <FilaTarifa slug={slug} tarifa={tarifa} lectura={lectura} sucursales={sucursales} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="zonas-reparto">
        <h3 id="zonas-reparto" className="text-pretty text-base font-semibold">
          Zonas de reparto
        </h3>
        {lectura ? null : (
          <FormularioZona slug={slug} sucursales={sucursales} sucursalId={sucursalId} zona={null} />
        )}
        {zonas.length === 0 ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Todavía no hay zonas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {zonas.map((zona) => (
              <li key={zona.id}>
                <FilaZona slug={slug} zona={zona} lectura={lectura} sucursales={sucursales} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ProbarEnvio sucursales={sucursales} sucursalId={sucursalId} />
    </div>
  );
}

function FilaTarifa({
  slug,
  tarifa,
  lectura,
  sucursales,
}: {
  slug: string;
  tarifa: TarifaLista;
  lectura: boolean;
  sucursales: Sucursal[];
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
    <article className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm tabular-nums">
        Hasta {tarifa.hastaKm} km · {formatoBs(tarifa.costo)} · {tarifa.sucursal}
      </p>
      {lectura ? null : editando ? (
        <FormularioTarifa slug={slug} sucursales={sucursales} sucursalId={tarifa.sucursalId} tarifa={tarifa} alCerrar={() => setEditando(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secundario" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Button type="button" variant="peligro" onClick={() => setConfirmar(true)}>
            Eliminar
          </Button>
        </div>
      )}
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
    </article>
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
      <Campo id={`${idForm}-sucursal`} etiqueta="Sucursal">
        <select id={`${idForm}-sucursal`} name="sucursalId" required defaultValue={sucursalId} className={claseCampo}>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
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

function FilaZona({
  slug,
  zona,
  lectura,
  sucursales,
}: {
  slug: string;
  zona: ZonaLista;
  lectura: boolean;
  sucursales: Sucursal[];
}) {
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const publicar = useToast();
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await eliminarZonaAccion(slug, zona.id, zona.sucursalId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-pretty text-base font-semibold">{zona.nombre}</h4>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {zona.activa ? (zona.tipo === "bloqueada" ? "Bloqueada" : "Tarifa fija") : "Inactiva"}
        </p>
      </div>
      <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        Radio {zona.radioKm} km
        {zona.costo != null ? ` · ${formatoBs(zona.costo)}` : ""} · {zona.sucursal}
      </p>
      {lectura ? null : editando ? (
        <FormularioZona slug={slug} sucursales={sucursales} sucursalId={zona.sucursalId} zona={zona} alCerrar={() => setEditando(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secundario" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Button type="button" variant="peligro" onClick={() => setConfirmar(true)}>
            Eliminar
          </Button>
        </div>
      )}
      <ConfirmDialog
        abierto={confirmar}
        titulo="Eliminar zona"
        descripcion={`Se quita ${zona.nombre}.`}
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
    </article>
  );
}

function FormularioZona({
  slug,
  sucursales,
  sucursalId,
  zona,
  alCerrar,
}: {
  slug: string;
  sucursales: Sucursal[];
  sucursalId: string;
  zona: ZonaLista | null;
  alCerrar?: () => void;
}) {
  const publicar = useToast();
  const idForm = zona ? `zona-${zona.id}` : "zona-nueva";
  const inicial = zona ?? sucursales.find((item) => item.id === sucursalId);
  const [lat, setLat] = useState(zona?.lat ?? inicial?.lat ?? null);
  const [lng, setLng] = useState(zona?.lng ?? inicial?.lng ?? null);
  const [radio, setRadio] = useState(zona ? String(zona.radioKm) : "1");
  const [tipo, setTipo] = useState(zona?.tipo ?? "tarifa_fija");
  const { run, loading, error, success } = useAsyncAction(async () => {
    const datos = new FormData(document.getElementById(idForm) as HTMLFormElement);
    const resultado = await guardarZonaAccion(slug, datos);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });
  const radioNumero = Number(radio.replace(",", "."));
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
          alCerrar?.();
        });
      }}
    >
      {zona ? <input type="hidden" name="id" value={zona.id} /> : null}
      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />
      <MapaCliente
        lat={lat}
        lng={lng}
        radioKm={Number.isFinite(radioNumero) ? radioNumero : null}
        onMove={(siguienteLat, siguienteLng) => {
          setLat(siguienteLat);
          setLng(siguienteLng);
        }}
      />
      <Campo id={`${idForm}-nombre`} etiqueta="Nombre">
        <input
          id={`${idForm}-nombre`}
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          defaultValue={zona?.nombre ?? ""}
          className={claseCampo}
        />
      </Campo>
      <Campo id={`${idForm}-sucursal`} etiqueta="Sucursal">
        <select id={`${idForm}-sucursal`} name="sucursalId" required defaultValue={sucursalId} className={claseCampo}>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`${idForm}-radio`} etiqueta="Radio (km)">
        <input
          id={`${idForm}-radio`}
          name="radioKm"
          inputMode="decimal"
          autoComplete="off"
          required
          value={radio}
          onChange={(event) => setRadio(event.target.value)}
          className={`${claseCampo} tabular-nums`}
        />
      </Campo>
      <Campo id={`${idForm}-tipo`} etiqueta="Tipo">
        <select
          id={`${idForm}-tipo`}
          name="tipo"
          required
          value={tipo}
          onChange={(event) => setTipo(event.target.value === "bloqueada" ? "bloqueada" : "tarifa_fija")}
          className={claseCampo}
        >
          <option value="tarifa_fija">Tarifa fija</option>
          <option value="bloqueada">Bloqueada</option>
        </select>
      </Campo>
      {tipo === "tarifa_fija" ? (
        <Campo id={`${idForm}-costo`} etiqueta="Costo">
          <input
            id={`${idForm}-costo`}
            name="costo"
            inputMode="decimal"
            autoComplete="off"
            required
            defaultValue={zona?.costo != null ? String(zona.costo) : ""}
            className={`${claseCampo} tabular-nums`}
          />
        </Campo>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={zona ? zona.activa : true} />
        Activa
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={loading} loadingLabel="Guardando…" success={success} error={error ?? false}>
          Guardar zona
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

function ProbarEnvio({ sucursales, sucursalId }: { sucursales: Sucursal[]; sucursalId: string }) {
  const origen = sucursales.find((sucursal) => sucursal.id === sucursalId) ?? sucursales[0];
  const [lat, setLat] = useState<number | null>(origen?.lat ?? null);
  const [lng, setLng] = useState<number | null>(origen?.lng ?? null);
  const [elegida, setElegida] = useState(sucursalId);
  const [resultado, setResultado] = useState<string | null>(null);
  const { run, loading, error } = useAsyncAction(async () => {
    const respuesta = await fetch("/api/envio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sucursalId: elegida, lat, lng }),
    });
    const cuerpo = (await respuesta.json()) as {
      error?: string;
      disponible?: boolean;
      motivo?: string;
      costo?: number;
      distanciaKm?: number;
    };
    if (!respuesta.ok) throw new Error(cuerpo.error ?? "No se pudo calcular el envío.");
    if (!cuerpo.disponible) {
      return cuerpo.motivo === "sin_ubicacion"
        ? "La sucursal no tiene ubicación."
        : "Fuera de zona.";
    }
    return `${formatoBs(cuerpo.costo ?? 0)} · ${cuerpo.distanciaKm} km`;
  });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="probar-envio">
      <h3 id="probar-envio" className="text-pretty text-base font-semibold">
        Probar un punto
      </h3>
      <Campo id="probar-sucursal" etiqueta="Sucursal">
        <select id="probar-sucursal" value={elegida} onChange={(event) => setElegida(event.target.value)} className={claseCampo}>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <MapaCliente
        lat={lat}
        lng={lng}
        onMove={(siguienteLat, siguienteLng) => {
          setLat(siguienteLat);
          setLng(siguienteLng);
        }}
      />
      <Button
        type="button"
        loading={loading}
        loadingLabel="Calculando envío…"
        error={error ?? false}
        onClick={() => {
          void run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            setResultado(hecho.valor.valor);
          });
        }}
      >
        Calcular envío
      </Button>
      <InlineLoader activo={loading}>Calculando envío...</InlineLoader>
      {resultado ? <p className="text-sm tabular-nums">{resultado}</p> : null}
    </section>
  );
}
