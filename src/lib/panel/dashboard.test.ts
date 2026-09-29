import assert from "node:assert/strict";
import { test } from "node:test";

import { inicialDia, variacionPorcentual } from "./dashboard.ts";

test("inicialDia usa la letra del día en español", () => {
  assert.equal(inicialDia("2026-09-28"), "L");
  assert.equal(inicialDia("2026-09-30"), "X");
  assert.equal(inicialDia("2026-10-04"), "D");
});

test("variacionPorcentual redondea y evita dividir por cero", () => {
  assert.equal(variacionPorcentual(1120, 1000), 12);
  assert.equal(variacionPorcentual(500, 1000), -50);
  assert.equal(variacionPorcentual(300, 0), null);
});
