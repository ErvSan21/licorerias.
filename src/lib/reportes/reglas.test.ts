import assert from "node:assert/strict";
import test from "node:test";

import { csvReporte, parseRango, reporteDesdeJson, sucursalesDelReporte } from "./reglas.ts";

test("el rango por defecto cabe en una semana y rechaza un año y un día", () => {
  const rango = parseRango(undefined, undefined, new Date("2026-09-28T15:00:00.000Z"));
  assert.equal(rango.hasta, "2026-09-28");
  assert.equal(rango.desde, "2026-09-22");
  assert.throws(() => parseRango("2026-01-01", "2027-02-01"), /año/);
  assert.throws(() => parseRango("2026-09-28", "2026-09-01"), /no es válido/);
});

test("una sucursal ajena no entra al reporte", () => {
  assert.deepEqual(sucursalesDelReporte(["s1", "s2"], ""), ["s1", "s2"]);
  assert.deepEqual(sucursalesDelReporte(["s1", "s2"], "s2"), ["s2"]);
  assert.throws(() => sucursalesDelReporte(["s1"], "s2"), /acceso/);
});

test("el csv no incluye datos que el json no trajo", () => {
  const reporte = reporteDesdeJson({
    ventas: 20,
    pedidos: 1,
    ticket: 20,
    cancelados: 0,
    montoCancelado: 0,
    sucursales: [{ id: "s1", nombre: "Centro", ventas: 20, pedidos: 1 }],
    productos: [{ nombre: "Paceña", unidades: 1, ventas: 20 }],
    masVendido: { nombre: "Paceña", unidades: 1 },
    menosVendido: { nombre: "Paceña", unidades: 1 },
    origenes: [{ origen: "central", ventas: 20 }],
    inventario: [{ id: "s1", nombre: "Centro", valor: 40 }],
    telefono: "59171234567",
  });
  const csv = csvReporte(reporte);
  assert.match(csv, /ventas,Total,1,,20.00/);
  assert.match(csv, /sucursal,Centro,1,,20.00/);
  assert.match(csv, /origen,central,,,20.00/);
  assert.equal(csv.includes("5917"), false);
  assert.equal("telefono" in reporte, false);
});
