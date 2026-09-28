import assert from "node:assert/strict";
import test from "node:test";

import { accionPedido, normalizarTelefono, rangoDiaBolivia } from "./reglas.ts";

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

test("el día de Bolivia cubre el offset -04", () => {
  assert.deepEqual(rangoDiaBolivia("2026-12-24"), {
    desde: "2026-12-24T00:00:00-04:00",
    hasta: "2026-12-24T23:59:59-04:00",
  });
  assert.equal(rangoDiaBolivia("24-12-2026"), null);
});
