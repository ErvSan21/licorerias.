"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

import { MapaCliente } from "@/components/panel/mapa-cliente";
import { Campo, claseCampo } from "@/components/super/campo";
import { useTienda, type DatosPedido } from "@/components/tienda/contexto";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { InlineLoader } from "@/components/ui/inline-loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectorCantidad } from "@/components/ui/selector-cantidad";
import { exitoMs } from "@/components/ui/tokens";
import { useAsyncAction } from "@/components/ui/use-async-action";
import { ImagenConCarga } from "@/components/ui/imagen";
import { formatoBs } from "@/lib/catalogo/reglas";
import { capitalizar } from "@/lib/texto";

type Pago = DatosPedido["metodoPago"];

export function Checkout({ telefonoInicial }: { telefonoInicial: string }) {
  const router = useRouter();
  const { estado, acciones, meta } = useTienda();
  const sucursal = meta.vitrina.sucursal;
  const slug = meta.vitrina.tienda.slug;
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [pago, setPago] = useState<Pago>("efectivo");
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    sucursal.lat != null && sucursal.lng != null ? { lat: sucursal.lat, lng: sucursal.lng } : null,
  );
  const publicarEnvio = useEffectEvent(acciones.setEnvio);
  const envioAccion = useAsyncAction(async () => {
    return acciones.confirmar({
      nombre,
      telefono,
      direccion,
      referencia,
      lat: punto?.lat ?? null,
      lng: punto?.lng ?? null,
      horaRecojo: null,
      metodoPago: pago,
    } satisfies DatosPedido);
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

  const delivery = estado.entrega === "delivery";
  const sinDelivery = delivery && !sucursal.aceptaDelivery;
  const sinRecojo = estado.entrega === "recojo" && !sucursal.aceptaRecojo;
  const qr = meta.vitrina.qrPagoUrl;
  const costoEnvio = delivery ? (estado.envio?.costo ?? null) : 0;
  const total = estado.total + (costoEnvio ?? 0);
  const etiquetaBoton = !sucursal.abiertaAhora
    ? "Sucursal cerrada"
    : sinDelivery
      ? "Esta sucursal no hace delivery"
      : sinRecojo
        ? "Esta sucursal no tiene recojo"
        : delivery && estado.envioError
        ? "Fuera de zona de entrega"
        : "Confirmar pedido";

  return (
    <Dialogo
      abierto
      titulo="Tu pedido"
      alCerrar={acciones.cerrarCheckout}
      alineacion="inferior"
      bloquearCierre={envioAccion.loading}
    >
      <Lineas />
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!event.currentTarget.reportValidity()) return;
          void envioAccion.run().then((resultado) => {
            if (resultado.omitida || !resultado.valor.ok) return;
            const id = resultado.valor.valor;
            window.setTimeout(() => router.push(`/t/${slug}/pedido/${id}`), exitoMs);
          });
        }}
      >
        <Entrega />

        {estado.entrega === "recojo" && !sinRecojo ? (
          <p className="text-sm text-[var(--mu)]">
            Recoges en {sucursal.nombre}
            {sucursal.direccion ? ` · ${sucursal.direccion}` : ""}.
          </p>
        ) : null}
        {sinRecojo ? <p className="tienda-aviso">Esta sucursal no tiene recojo en tienda. Elige Delivery.</p> : null}
        {sinDelivery ? <p className="tienda-aviso">Esta sucursal no hace delivery. Elige Recojo en tienda.</p> : null}

        {delivery && !sinDelivery ? (
          <>
            <p className="text-sm text-[var(--mu)]">Mueve el pin a tu ubicación para calcular el envío.</p>
            <MapaCliente lat={punto?.lat ?? null} lng={punto?.lng ?? null} onMove={(lat, lng) => setPunto({ lat, lng })} />
            <div aria-live="polite" className="text-sm">
              {estado.envioCargando ? <InlineLoader>Calculando envío…</InlineLoader> : null}
              {estado.envioError ? <p className="text-[var(--er)]">{estado.envioError}</p> : null}
              {estado.envio && !estado.envioCargando ? (
                <p className="tabular-nums text-[var(--mu)]">
                  Distancia {estado.envio.distanciaKm} km · envío {formatoBs(estado.envio.costo)}
                </p>
              ) : null}
            </div>
            <Campo id="pedido-direccion" etiqueta="Dirección">
              <input
                id="pedido-direccion"
                name="street-address"
                autoComplete="street-address"
                required
                minLength={4}
                value={direccion}
                onChange={(event) => setDireccion(event.target.value)}
                className={claseCampo}
              />
            </Campo>
            <Campo id="pedido-referencia" etiqueta="Referencia (opcional)">
              <input
                id="pedido-referencia"
                name="referencia"
                autoComplete="off"
                placeholder="Color de la casa, piso, timbre…"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                className={claseCampo}
              />
            </Campo>
          </>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo id="pedido-nombre" etiqueta="Nombre">
            <input
              id="pedido-nombre"
              name="nombre"
              autoComplete="name"
              autoCapitalize="words"
              required
              minLength={2}
              value={nombre}
              onChange={(event) => setNombre(capitalizar(event.target.value))}
              className={claseCampo}
            />
          </Campo>
          <Campo id="pedido-telefono" etiqueta="Celular">
            <input
              id="pedido-telefono"
              name="tel"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="7XXXXXXX"
              required
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              className={claseCampo}
            />
          </Campo>
        </div>

        {qr ? (
          <SegmentedControl
            etiqueta="Método de pago"
            valor={pago}
            opciones={[
              { valor: "efectivo", etiqueta: "Efectivo" },
              { valor: "qr", etiqueta: "QR" },
            ]}
            onChange={setPago}
          />
        ) : null}
        {pago === "qr" && qr ? (
          <div className="tienda-qr">
            <ImagenConCarga src={qr} alt="QR para pagar el pedido" width={320} height={320} className="tienda-qr-imagen" />
            <p className="text-sm text-[var(--mu)]">
              Escanea el QR y paga {formatoBs(total)}. La tienda verifica tu pago y te avisa.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--mu)]">
            Pagas en efectivo al {delivery ? "recibir" : "recoger"} tu pedido.
          </p>
        )}

        <dl className="tienda-resumen">
          <div>
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatoBs(estado.total)}</dd>
          </div>
          {delivery ? (
            <div>
              <dt>Envío</dt>
              <dd className="tabular-nums">{costoEnvio == null ? "—" : formatoBs(costoEnvio)}</dd>
            </div>
          ) : null}
          <div className="tienda-resumen-total">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatoBs(total)}</dd>
          </div>
        </dl>

        {envioAccion.error ? (
          <p role="alert" className="text-sm text-[var(--er)]">
            {envioAccion.error}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={envioAccion.loading}
          loadingLabel="Enviando pedido…"
          success={envioAccion.success}
          error={envioAccion.error ?? false}
          disabled={!estado.puedeConfirmar}
        >
          {etiquetaBoton}
        </Button>
      </form>
    </Dialogo>
  );
}

function Lineas() {
  const { estado, acciones, meta } = useTienda();
  if (estado.lineas.length === 0) {
    return <p className="text-sm text-[var(--mu)]">Tu pedido está vacío. Agrega productos con el botón +.</p>;
  }
  return (
    <ul aria-label="Productos del pedido" className="flex flex-col gap-3">
      {estado.lineas.map((linea) => {
        const producto = meta.productos.get(linea.productoId);
        if (!producto) return null;
        return (
          <li key={linea.productoId} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block break-words">{capitalizar(producto.nombre)}</span>
              <span className="text-sm tabular-nums text-[var(--mu)]">{formatoBs(producto.precioFinal * linea.cantidad)}</span>
            </span>
            <SelectorCantidad
              valor={linea.cantidad}
              min={0}
              etiqueta={`Cantidad de ${capitalizar(producto.nombre)}`}
              onChange={(valor) => {
                acciones.cambiarCantidad(linea.productoId, valor);
                if (valor === 0 && estado.lineas.length === 1) acciones.cerrarCheckout();
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Recojo en tienda primero, delivery después. */
function Entrega() {
  const { estado, acciones } = useTienda();
  return (
    <SegmentedControl
      etiqueta="Entrega"
      valor={estado.entrega ?? "recojo"}
      opciones={[
        { valor: "recojo", etiqueta: "Recojo en tienda" },
        { valor: "delivery", etiqueta: "Delivery" },
      ]}
      onChange={acciones.setEntrega}
    />
  );
}
