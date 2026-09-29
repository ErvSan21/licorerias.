import assert from "node:assert/strict";
import test from "node:test";

import {
  accionPedido,
  etiquetaEstadoPedido,
  indiceSeguimiento,
  pasosVenta,
  intervaloSeguimientoMs,
  mensajeSeguimiento,
  normalizarTelefono,
  pedidoDesdeJson,
  pasosSeguimiento,
  rangoDiaBolivia,
  seguimientoDesdeJson,
} from "./reglas.ts";

test("las ventas del panel siguen su propio flujo según la entrega", () => {
  const siguiente = (estado: Parameters<typeof accionPedido>[0], tipo: "delivery" | "recojo") =>
    accionPedido(estado, tipo, "panel")?.estado ?? null;
  assert.equal(siguiente("pendiente", "recojo"), "aceptado");
  assert.equal(siguiente("aceptado", "recojo"), "entregado");
  assert.equal(siguiente("entregado", "recojo"), null);
  assert.equal(siguiente("aceptado", "delivery"), "preparando");
  assert.equal(siguiente("preparando", "delivery"), "recogido");
  assert.equal(siguiente("recogido", "delivery"), "entregado");
  assert.equal(accionPedido("recogido", "delivery", "panel")?.cancelar, false);
  assert.equal(accionPedido("preparando", "delivery", "panel")?.cancelar, true);
  // La tienda en línea no cambia.
  assert.equal(accionPedido("aceptado", "recojo")?.estado, "listo");
  assert.deepEqual(pasosVenta("recojo"), ["pendiente", "aceptado", "entregado"]);
  assert.equal(etiquetaEstadoPedido("pendiente", "panel"), "Registrado");
  assert.equal(etiquetaEstadoPedido("pendiente"), "Nuevo");
});

test("en el mostrador, recojo acepta pedido sin nombre ni celular; delivery y la tienda no", () => {
  const base = {
    sucursalId: "0b8f0f2e-8a4a-4a53-9b0e-6f6f4a1f2c11",
    tipo: "recojo",
    nombre: "",
    telefono: "",
    items: [{ productoId: "5d1f7c3a-2b6e-4a8f-9c3d-1e2f3a4b5c6d", cantidad: 1 }],
  };
  const venta = pedidoDesdeJson(base, { mostrador: true });
  assert.equal(venta.nombre, "Cliente");
  assert.equal(venta.telefono, null);
  assert.throws(() => pedidoDesdeJson(base), /nombre/i);
  assert.throws(
    () => pedidoDesdeJson({ ...base, tipo: "delivery", nombre: "Ana", direccion: "Av. Arce 100" }, { mostrador: true }),
    /celular/,
  );
});

test("el teléfono boliviano queda en 591 sin símbolos", () => {
  assert.equal(normalizarTelefono("71234567"), "59171234567");
  assert.equal(normalizarTelefono("+591 7123 4567"), "59171234567");
  assert.throws(() => normalizarTelefono("123"), /celular/);
});

test("cada estado ofrece solo la siguiente acción", () => {
  assert.equal(accionPedido("pendiente", "recojo")?.etiqueta, "Aceptar pedido");
  assert.equal(accionPedido("aceptado", "delivery")?.estado, "listo");
  assert.equal(accionPedido("listo", "delivery")?.estado, "enviado");
  assert.equal(accionPedido("listo", "recojo"), null);
  assert.equal(accionPedido("enviado", "delivery"), null);
  assert.equal(accionPedido("cancelado", "recojo"), null);
});

test("la línea de tiempo llega hasta En camino solo en delivery", () => {
  assert.deepEqual(pasosSeguimiento("recojo"), ["Recibido", "Aceptado", "Listo"]);
  assert.equal(pasosSeguimiento("delivery").at(-1), "En camino");
  assert.equal(indiceSeguimiento("pendiente", "recojo"), 0);
  assert.equal(indiceSeguimiento("listo", "recojo"), 2);
  assert.equal(indiceSeguimiento("enviado", "delivery"), 3);
  assert.equal(indiceSeguimiento("cancelado", "delivery"), -1);
  assert.equal(mensajeSeguimiento("pendiente", "delivery"), "Recibido");
  assert.equal(mensajeSeguimiento("listo", "recojo"), "Listo");
  assert.equal(mensajeSeguimiento("cancelado", "recojo"), "Pedido cancelado");
  assert.equal(intervaloSeguimientoMs, 15_000);
});

test("el seguimiento público no acepta un JSON incompleto", () => {
  const pedido = seguimientoDesdeJson({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    estado: "aceptado",
    tipoEntrega: "recojo",
    sucursal: "Centro",
    total: "20.00",
    subtotal: 20,
    costoEnvio: 0,
    descuento: 0,
    horaRecojo: null,
    direccion: "",
    referencia: "",
    items: [{ nombre: "Paceña", cantidad: 1, precioUnitario: 20 }],
    creadoEn: "2026-09-28T12:00:00.000Z",
    telefono: "59171234567",
  });
  assert.equal(pedido?.estado, "aceptado");
  assert.equal(pedido?.total, 20);
  assert.equal("telefono" in (pedido ?? {}), false);
  assert.equal(seguimientoDesdeJson({ estado: "pendiente" }), null);
});

test("el día de Bolivia cubre el offset -04", () => {
  assert.deepEqual(rangoDiaBolivia("2026-12-24"), {
    desde: "2026-12-24T00:00:00-04:00",
    hasta: "2026-12-24T23:59:59-04:00",
  });
  assert.equal(rangoDiaBolivia("24-12-2026"), null);
});

test("el cliente no fija precio, envío ni tienda", () => {
  const pedido = pedidoDesdeJson({
    sucursalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nombre: "Ana",
    telefono: "71234567",
    tipo: "recojo",
    items: [
      {
        productoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        cantidad: 1,
        precio: 1,
      },
    ],
    precio: 1,
    costoEnvio: 99,
    envio: 99,
    tiendaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    distanciaKm: 40,
  });
  assert.deepEqual(pedido.items, [
    { productoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cantidad: 1 },
  ]);
  assert.equal("precio" in pedido, false);
  assert.equal("costoEnvio" in pedido, false);
  assert.equal("envio" in pedido, false);
  assert.equal("tiendaId" in pedido, false);
  assert.equal("distanciaKm" in pedido, false);
});
