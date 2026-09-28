import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  cifrarToken,
  debeSaludar,
  descifrarToken,
  elegirCredencial,
  enlaceCatalogo,
  mensajeBienvenida,
  mensajeEstado,
  mensajesWebhook,
  parseTokenNuevo,
  ultimosToken,
  ventanaSaludoMs,
  vistaCredencial,
  type PedidoAviso,
} from "./reglas.ts";

const pedido: PedidoAviso = {
  id: "abcd1234-0000-4000-8000-000000000001",
  estado: "pendiente",
  tipo: "recojo",
  total: 20,
  tienda: "Barril",
  sucursal: "Centro",
  slug: "barril",
  horaRecojo: null,
  origen: "http://localhost:5000",
};

test("cada estado arma el aviso con tienda, sucursal y número", () => {
  const recibido = mensajeEstado(pedido);
  assert.match(recibido, /🧾 Barril · Centro · Pedido #ABCD/);
  assert.match(recibido, /🛒 Pedido #ABCD recibido, total Bs/);
  assert.match(recibido, /http:\/\/localhost:5000\/t\/barril\/pedido\/abcd1234/);

  assert.match(mensajeEstado({ ...pedido, estado: "aceptado" }), /✅ Tu pedido fue aceptado, ya lo estamos preparando/);
  assert.match(
    mensajeEstado({ ...pedido, estado: "listo", tipo: "delivery" }),
    /🛵 Tu pedido está listo y saldrá a reparto en breve/,
  );
  assert.match(
    mensajeEstado({ ...pedido, estado: "listo", horaRecojo: "2026-09-28T22:30:00.000Z" }),
    /📦 Tu pedido está listo, puedes pasar a recogerlo en Centro a las /,
  );
  assert.match(mensajeEstado({ ...pedido, estado: "enviado", tipo: "delivery" }), /🚚 Tu pedido va en camino/);
  assert.match(mensajeEstado({ ...pedido, estado: "cancelado" }), /❌ Tu pedido fue cancelado, escríbenos si tienes dudas/);
});

test("la bienvenida lleva el enlace de la tienda o de la sucursal", () => {
  assert.match(mensajeBienvenida("Barril", "http://localhost:5000/t/barril?tel=59171234567"), /Hola, te damos la bienvenida a Barril/);
  assert.equal(
    enlaceCatalogo("http://localhost:5000/", "barril", "centro", "59171234567"),
    "http://localhost:5000/t/barril/s/centro?tel=59171234567",
  );
  assert.equal(enlaceCatalogo("http://localhost:5000", "barril", null, "59171234567"), "http://localhost:5000/t/barril?tel=59171234567");
});

test("la credencial de la sucursal gana y, si no hay, se usa la de la tienda", () => {
  const filas = [
    { id: "tienda", sucursalId: null, activo: true },
    { id: "sucursal", sucursalId: "s1", activo: true },
    { id: "apagada", sucursalId: "s2", activo: false },
  ];
  assert.equal(elegirCredencial(filas, "s1")?.id, "sucursal");
  assert.equal(elegirCredencial(filas, "s2")?.id, "tienda");
  assert.equal(elegirCredencial(filas, null)?.id, "tienda");
  assert.equal(elegirCredencial(filas.filter((fila) => fila.id !== "tienda"), "s2"), null);
});

test("el saludo se repite solo después de 12 horas", () => {
  const ahora = new Date("2026-09-28T18:00:00.000Z");
  assert.equal(debeSaludar(null, ahora), true);
  assert.equal(debeSaludar(new Date(ahora.getTime() - ventanaSaludoMs), ahora), false);
  assert.equal(debeSaludar(new Date(ahora.getTime() - ventanaSaludoMs - 1), ahora), true);
});

test("el webhook ignora estados y solo toma mensajes", () => {
  const cuerpo = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "123456" },
              statuses: [{ id: "wamid", status: "delivered" }],
              messages: [{ from: "59171234567" }, { from: "no" }],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(mensajesWebhook(cuerpo), [{ phoneNumberId: "123456", from: "59171234567" }]);
  assert.deepEqual(mensajesWebhook({ entry: [{ changes: [{ value: { statuses: [{ status: "read" }] } }] }] }), []);
});

test("el token se cifra y la vista no lo devuelve", () => {
  const clave = randomBytes(32);
  const cifrado = cifrarToken("EAAG-token-de-prueba-largo", clave);
  assert.equal(descifrarToken(cifrado, clave), "EAAG-token-de-prueba-largo");
  assert.notEqual(cifrado, "EAAG-token-de-prueba-largo");
  assert.equal(ultimosToken("EAAG-token-de-prueba-largo"), "argo");
  assert.equal(parseTokenNuevo(""), null);
  assert.throws(() => parseTokenNuevo("corto"), /token/);
  const vista = vistaCredencial({
    sucursalId: null,
    phoneNumberId: "123456",
    wabaId: "654321",
    tokenUltimos: "argo",
    activo: true,
    tokenCifrado: cifrado,
  });
  assert.equal("tokenCifrado" in vista, false);
});
