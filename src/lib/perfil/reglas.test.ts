import assert from "node:assert/strict";
import { test } from "node:test";

import { nombreVisible, parsePerfil, perfilDesdeMetadata } from "./reglas.ts";

test("parsePerfil pone mayúscula inicial y normaliza el celular", () => {
  assert.deepEqual(parsePerfil({ nombre: "ana", apellido: "pérez", celular: "71234567" }), {
    nombre: "Ana",
    apellido: "Pérez",
    celular: "59171234567",
  });
  assert.equal(parsePerfil({ nombre: "Ana", apellido: "Pérez", celular: "" }).celular, null);
  assert.throws(() => parsePerfil({ nombre: "A", apellido: "Pérez" }), /nombre/);
  assert.throws(() => parsePerfil({ nombre: "Ana", apellido: "Pérez", celular: "123" }), /celular/);
});

test("nombreVisible usa nombre y apellido, o el correo si faltan", () => {
  assert.equal(nombreVisible(perfilDesdeMetadata({ nombre: "Ana", apellido: "Pérez" }), "ana@x.bo"), "Ana Pérez");
  assert.equal(nombreVisible(perfilDesdeMetadata(null), "ana@x.bo"), "ana@x.bo");
});
