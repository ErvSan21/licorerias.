import assert from "node:assert/strict";
import { test } from "node:test";

import { slugDeTienda } from "./reglas.ts";

test("slugDeTienda quita tildes y símbolos", () => {
  assert.equal(slugDeTienda("Licorería Don Pepe"), "licoreria-don-pepe");
  assert.equal(slugDeTienda("  El Barril & Cía.  "), "el-barril-cia");
  assert.equal(slugDeTienda("Ñandú 24/7"), "nandu-24-7");
});

test("slugDeTienda agrega el sufijo desde el segundo intento", () => {
  assert.equal(slugDeTienda("La Esquina", 1), "la-esquina");
  assert.equal(slugDeTienda("La Esquina", 2), "la-esquina-2");
});

test("slugDeTienda usa 'tienda' si no queda nada y corta a 40", () => {
  assert.equal(slugDeTienda("¡¡!!"), "tienda");
  const largo = slugDeTienda("a".repeat(39) + " bbbb");
  assert.ok(largo.length <= 40 && !largo.endsWith("-"));
});
