import assert from "node:assert/strict";
import { test } from "node:test";

import { coordenadasDesdeTexto, esEnlaceCorto } from "./ubicacion.ts";

test("coordenadasDesdeTexto entiende los links de Google Maps", () => {
  assert.deepEqual(
    coordenadasDesdeTexto(
      "https://www.google.com/maps/place/Plaza+Murillo/@-16.4958,-68.1334,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-16.495712!4d-68.133625",
    ),
    { lat: -16.495712, lng: -68.133625 },
  );
  assert.deepEqual(coordenadasDesdeTexto("https://www.google.com/maps/@-16.5,-68.15,15z"), { lat: -16.5, lng: -68.15 });
  assert.deepEqual(coordenadasDesdeTexto("https://maps.google.com/?q=-16.51,-68.12"), { lat: -16.51, lng: -68.12 });
  assert.deepEqual(
    coordenadasDesdeTexto("https://www.google.com/maps/search/?api=1&query=-16.52%2C-68.11"),
    { lat: -16.52, lng: -68.11 },
  );
});

test("coordenadasDesdeTexto acepta lat, lng escrito a mano y rechaza lo inválido", () => {
  assert.deepEqual(coordenadasDesdeTexto("-16.5000, -68.1500"), { lat: -16.5, lng: -68.15 });
  assert.equal(coordenadasDesdeTexto("https://www.google.com/maps/place/Plaza+Murillo"), null);
  assert.equal(coordenadasDesdeTexto("200, 10"), null);
  assert.equal(coordenadasDesdeTexto("0, 0"), null);
});

test("esEnlaceCorto solo reconoce los enlaces cortos de Google", () => {
  assert.equal(esEnlaceCorto("https://maps.app.goo.gl/abc123"), true);
  assert.equal(esEnlaceCorto("https://goo.gl/maps/abc"), true);
  assert.equal(esEnlaceCorto("https://evil.example/maps"), false);
  assert.equal(esEnlaceCorto("http://maps.app.goo.gl/abc"), false);
});
