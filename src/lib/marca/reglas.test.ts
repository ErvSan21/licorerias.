import assert from "node:assert/strict";
import test from "node:test";

import { contrasteSuficiente, marcaDesdeJson, nombreVisible, parseColorMarca, parseNombreComercial } from "./reglas.ts";

test("un color oscuro o claro pasa y un gris medio no", () => {
  assert.equal(contrasteSuficiente("#7f1d1d"), true);
  assert.equal(contrasteSuficiente("#fafafa"), true);
  assert.equal(contrasteSuficiente("#888888"), false);
  assert.throws(() => parseColorMarca("#888888"), /contrasta/);
  assert.equal(parseColorMarca("#7F1D1D"), "#7f1d1d");
  assert.equal(parseColorMarca(""), null);
});

test("el nombre comercial y la marca pública no arrastran campos de precio", () => {
  assert.equal(parseNombreComercial("  La Esquina  "), "La Esquina");
  assert.throws(() => parseNombreComercial("A"), /2 y 60/);
  const marca = marcaDesdeJson({
    nombreComercial: "La Esquina",
    logoUrl: null,
    colorPrimario: "#7f1d1d",
    bannerUrl: null,
    mensajeBienvenida: "Pide aquí",
    margen_max_porcentaje: 10,
  });
  assert.equal("margen_max_porcentaje" in marca, false);
  assert.equal(nombreVisible(marca, "Tienda"), "La Esquina");
  assert.equal(nombreVisible({ ...marca, nombreComercial: null }, "Tienda"), "Tienda");
});
