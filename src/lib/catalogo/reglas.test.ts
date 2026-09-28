import assert from "node:assert/strict";
import test from "node:test";

import {
  formatoBs,
  parsePorcentaje,
  parsePrecio,
  precioDentroDeMargen,
  precioEfectivo,
  topeMargen,
} from "./reglas.ts";

test("el precio acepta cero y dos decimales", () => {
  assert.equal(parsePrecio("0"), 0);
  assert.equal(parsePrecio("10,5"), 10.5);
  assert.equal(parsePrecio("27.50"), 27.5);
  assert.throws(() => parsePrecio("-1"), /precio en Bs/);
  assert.throws(() => parsePrecio("1.234"), /precio en Bs/);
});

test("el porcentaje queda entre -100 y 1000", () => {
  assert.equal(parsePorcentaje("-10"), -10);
  assert.equal(parsePorcentaje("10,5"), 10.5);
  assert.throws(() => parsePorcentaje("-101"), /entre -100 y 1000/);
});

test("el margen limita el precio propio", () => {
  assert.equal(topeMargen(25, 10), 27.5);
  assert.equal(topeMargen(25, null), null);
  assert.equal(precioDentroDeMargen(27.5, 25, 10), true);
  assert.equal(precioDentroDeMargen(30, 25, 10), false);
  assert.equal(precioDentroDeMargen(30, 25, null), true);
});

test("el precio efectivo sigue la regla central o propio", () => {
  const base = {
    activo: true,
    disponible: true,
    usaPrecioCentral: false,
    precioCentral: 25,
    precioPropio: 30,
    permitenPrecioPropio: true,
  };
  assert.equal(precioEfectivo({ ...base, usaPrecioCentral: true }), 25);
  assert.equal(precioEfectivo(base), 30);
  assert.equal(precioEfectivo({ ...base, permitenPrecioPropio: false }), 25);
  assert.equal(precioEfectivo({ ...base, disponible: false }), null);
  assert.equal(precioEfectivo({ ...base, activo: false }), null);
});

test("el formato de dinero usa Bs y dos decimales", () => {
  assert.match(formatoBs(27.5), /^Bs /);
  assert.match(formatoBs(27.5), /27[,.]50/);
});
