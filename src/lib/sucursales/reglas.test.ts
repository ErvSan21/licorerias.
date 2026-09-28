import assert from "node:assert/strict";
import test from "node:test";

import {
  accesoSucursal,
  horarioPorDefecto,
  parseCoordenadas,
  parseHorario,
  parseTelefono,
} from "./reglas.ts";

test("el teléfono boliviano se guarda con 591 y sin símbolos", () => {
  assert.equal(parseTelefono("70123456"), "59170123456");
  assert.equal(parseTelefono("+591 7012-3456"), "59170123456");
  assert.equal(parseTelefono("  "), null);
  assert.throws(() => parseTelefono("123"), /8 dígitos/);
});

test("el horario rechaza un cierre anterior a la apertura", () => {
  const base = horarioPorDefecto();
  assert.equal(base.dom.abierto, false);
  assert.throws(
    () => parseHorario({ ...base, lun: { abierto: true, desde: "21:00", hasta: "09:00" } }),
    /cerrar después de abrir/,
  );
});

test("las coordenadas van juntas y dentro del mapa", () => {
  assert.equal(parseCoordenadas("", ""), null);
  assert.deepEqual(parseCoordenadas("-16.5", "-68.15"), { lat: -16.5, lng: -68.15 });
  assert.throws(() => parseCoordenadas("100", "-68"), /latitud/);
});

test("el dueño entra a cualquier sucursal y el resto solo a la asignada", () => {
  assert.equal(accesoSucursal("dueno", false), true);
  assert.equal(accesoSucursal("gerente", false), false);
  assert.equal(accesoSucursal("vendedor", true), true);
});
