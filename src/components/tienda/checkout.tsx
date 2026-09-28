"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { MapaCliente } from "@/components/panel/mapa-cliente";
import { Campo, claseCampo } from "@/components/super/campo";
import { useTienda, type DatosPedido } from "@/components/tienda/contexto";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { InlineLoader } from "@/components/ui/inline-loader";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { formatoBs, formatoFechaPrecio } from "@/lib/catalogo/reglas";
import { opcionesRecojo } from "@/lib/tienda/reglas";

export function Checkout({ telefonoInicial }: { telefonoInicial: string }) {
  const { estado, acciones, meta } = useTienda();
  const sucursal = meta.vitrina.sucursal;
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    sucursal.lat != null && sucursal.lng != null ? { lat: sucursal.lat, lng: sucursal.lng } : null,
  );
  const [hora, setHora] = useState("");
  const horas = opcionesRecojo(sucursal.horario, sucursal.minutosRecojo, new Date());
  const publicarEnvio = useEffectEvent(acciones.setEnvio);
  const envioAccion = useAsyncAction(async () => {
    const respuesta = await acciones.confirmar({
      nombre,
      telefono,
      direccion,
      referencia,
      lat: punto?.lat ?? null,
      lng: punto?.lng ?? null,
      horaRecojo: hora || null,
    } satisfies DatosPedido);
    return respuesta;
  });

  useEffect(() => {
    if (estado.entrega !== "delivery" || !punto) {
      publicarEnvio(null, null, false);
      return;
    }
    const controlador = new AbortController();
    const timer = window.setTimeout(() => {
      publicarEnvio(null, null, true);
      void fetch("/api/envio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sucursalId: sucursal.id, lat: punto.lat, lng: punto.lng }),
        signal: controlador.signal,
      })
        .then(async (respuesta) => {
          const cuerpo = (await respuesta.json().catch(() => null)) as {
            disponible?: boolean;
            distanciaKm?: number;
            costo?: number;
            error?: string;
          } | null;
          if (!respuesta.ok || !cuerpo) {
            publicarEnvio(null, cuerpo?.error || "No se pudo calcular el envío.", false);
            return;
          }
          if (!cuerpo.disponible || cuerpo.costo == null || cuerpo.distanciaKm == null) {
            publicarEnvio(null, "Fuera de zona de entrega.", false);
            return;
          }
          publicarEnvio({ distanciaKm: cuerpo.distanciaKm, costo: cuerpo.costo }, null, false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          publicarEnvio(null, "No se pudo calcular el envío.", false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controlador.abort();
    };
  }, [estado.entrega, punto, sucursal.id]);

  if (!estado.checkout) return null;

  const total = estado.total + (estado.entrega === "delivery" ? (estado.envio?.costo ?? 0) : 0);

  return (
    <Dialogo abierto titulo="Confirmar pedido" alCerrar={acciones.cerrarCheckout} alineacion="inferior" bloquearCierre={envioAccion.loading}>
        <Lineas />
        <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void envioAccion.run();
        }}
      >
        <Campo id="pedido-nombre" etiqueta="Nombre">
          <input id="pedido-nombre" name="nombre" autoComplete="name" required value={nombre} onChange={(event) => setNombre(event.target.value)} className={claseCampo} />
        </Campo>
        <Campo id="pedido-telefono" etiqueta="Celular">
          <input id="pedido-telefono" name="tel" type="tel" autoComplete="tel" inputMode="tel" required value={telefono} onChange={(event) => setTelefono(event.target.value)} className={claseCampo} />
        </Campo>
        <Entrega />
        {estado.entrega === "recojo" ? (
          <Campo id="pedido-hora" etiqueta="Hora de recojo">
            <select id="pedido-hora" name="hora-recojo" value={hora} onChange={(event) => setHora(event.target.value)} className={claseCampo}>
              <option value="">Lo antes posible</option>
              {horas.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {formatoFechaPrecio(opcion)}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        {estado.entrega === "delivery" ? (
          <>
            <MapaCliente
              lat={punto?.lat ?? null}
              lng={punto?.lng ?? null}
              onMove={(lat, lng) => setPunto({ lat, lng })}
            />
            <div aria-live="polite">
              {estado.envioCargando ? <InlineLoader>Calculando envío…</InlineLoader> : null}
              {estado.envioError ? <p className="text-sm text-red-800 dark:text-red-300">{estado.envioError}</p> : null}
              {estado.envio ? (
                <p className="text-sm tabular-nums">
                  {estado.envio.distanciaKm} km · envío {formatoBs(estado.envio.costo)}
                </p>
              ) : null}
            </div>
            <Campo id="pedido-direccion" etiqueta="Dirección">
              <input id="pedido-direccion" name="street-address" autoComplete="street-address" required value={direccion} onChange={(event) => setDireccion(event.target.value)} className={claseCampo} />
            </Campo>
            <Campo id="pedido-referencia" etiqueta="Referencia">
              <input id="pedido-referencia" name="referencia" autoComplete="off" value={referencia} onChange={(event) => setReferencia(event.target.value)} className={claseCampo} />
            </Campo>
          </>
        ) : null}
        <p className="text-base font-semibold tabular-nums">Total {formatoBs(total)}</p>
        {envioAccion.error ? <p className="text-sm text-red-800 dark:text-red-300">{envioAccion.error}</p> : null}
        <Button
          type="submit"
          loading={envioAccion.loading}
          loadingLabel="Enviando pedido…"
          success={envioAccion.success}
          error={envioAccion.error ?? false}
          disabled={!estado.puedeConfirmar}
        >
          Confirmar pedido
        </Button>
      </form>
    </Dialogo>
  );
}

function Lineas() {
  const { estado, acciones, meta } = useTienda();
  if (estado.lineas.length === 0) return null;
  return (
    <ul aria-label="Productos del pedido" className="flex flex-col gap-2">
      {estado.lineas.map((linea) => {
        const producto = meta.productos.get(linea.productoId);
        if (!producto) return null;
        return (
          <li key={linea.productoId} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm line-clamp-2">{producto.nombre}</span>
              <span className="text-sm tabular-nums">{formatoBs(producto.precioFinal)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="ui-boton min-h-11 min-w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
                aria-label={`Quitar uno de ${producto.nombre}`}
                onClick={() => acciones.cambiarCantidad(linea.productoId, linea.cantidad - 1)}
              >
                −
              </button>
              <span className="w-6 text-center text-sm tabular-nums">{linea.cantidad}</span>
              <button
                type="button"
                className="ui-boton min-h-11 min-w-11 rounded-lg border border-zinc-300 text-lg dark:border-zinc-700"
                aria-label={`Agregar uno de ${producto.nombre}`}
                onClick={() => acciones.cambiarCantidad(linea.productoId, linea.cantidad + 1)}
              >
                +
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Entrega() {
  const { estado, acciones, meta } = useTienda();
  const { aceptaDelivery, aceptaRecojo } = meta.vitrina.sucursal;
  if (aceptaDelivery === aceptaRecojo) {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Entrega</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="entrega" checked={estado.entrega === "delivery"} onChange={() => acciones.setEntrega("delivery")} />
          Delivery
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="entrega" checked={estado.entrega === "recojo"} onChange={() => acciones.setEntrega("recojo")} />
          Recojo en tienda
        </label>
      </fieldset>
    );
  }
  return <p className="text-sm">{estado.entrega === "delivery" ? "Delivery" : "Recojo en tienda"}</p>;
}
