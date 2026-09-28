import assert from "node:assert/strict";
import test from "node:test";

import {
  aTimestamptzBolivia,
  estadoOferta,
  precioConOfertas,
  rangoValido,
} from "./reglas.ts";

test("la oferta de menor precio gana y el origen queda en oferta", () => {
  const resultado = precioConOfertas({
    base: 20,
    origenBase: "propio",
    ofertas: [
      { tipo: "porcentaje", valor: 10 },
      { tipo: "precio_fijo", valor: 15 },
    ],
  });
  assert.equal(resultado.precioOriginal, 20);
  assert.equal(resultado.precioFinal, 15);
  assert.equal(resultado.origen, "oferta");
});

test("un precio fijo más caro no cambia el origen", () => {
  const resultado = precioConOfertas({
    base: 10,
    origenBase: "central",
    ofertas: [{ tipo: "precio_fijo", valor: 12 }],
  });
  assert.equal(resultado.precioFinal, 10);
  assert.equal(resultado.origen, "central");
});

test("el porcentaje se calcula sobre el precio base", () => {
  const resultado = precioConOfertas({
    base: 20,
    origenBase: "propio",
    ofertas: [{ tipo: "porcentaje", valor: 10 }],
  });
  assert.equal(resultado.precioFinal, 18);
});

test("el estado sigue las fechas de Bolivia", () => {
  assert.equal(
    estadoOferta({
      inicio: "2026-12-01T04:00:00.000Z",
      fin: "2026-12-31T04:00:00.000Z",
      activa: true,
      ahora: new Date("2026-12-10T15:00:00.000Z"),
    }),
    "vigente",
  );
  assert.equal(
    estadoOferta({
      inicio: "2026-12-20T04:00:00.000Z",
      fin: "2026-12-31T04:00:00.000Z",
      activa: true,
      ahora: new Date("2026-12-01T15:00:00.000Z"),
    }),
    "programada",
  );
  assert.equal(
    estadoOferta({
      inicio: "2026-11-01T04:00:00.000Z",
      fin: "2026-11-20T04:00:00.000Z",
      activa: true,
      ahora: new Date("2026-12-01T15:00:00.000Z"),
    }),
    "vencida",
  );
  assert.equal(
    estadoOferta({
      inicio: "2026-12-01T04:00:00.000Z",
      fin: "2026-12-31T04:00:00.000Z",
      activa: false,
      ahora: new Date("2026-12-10T15:00:00.000Z"),
    }),
    "inactiva",
  );
});

test("las fechas locales se guardan con offset de Bolivia", () => {
  assert.equal(aTimestamptzBolivia("2026-12-24T18:30"), "2026-12-24T18:30:00-04:00");
  assert.throws(() => aTimestamptzBolivia("2026-13-01T10:00"), /fecha/);
  assert.throws(() => rangoValido("2026-12-24T22:00:00.000Z", "2026-12-24T22:00:00.000Z"), /posterior/);
});
