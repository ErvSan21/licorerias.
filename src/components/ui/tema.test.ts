import assert from "node:assert/strict";
import test from "node:test";

import { contraste, degradadoLegible, hexAHsl, parejaMarca } from "./tema.ts";

test("deriva el segundo color y mantiene el blanco legible sobre el degradado", () => {
  const pareja = parejaMarca("#1e40af");
  assert.ok(pareja);
  assert.equal(pareja.br, "#1e40af");
  assert.notEqual(pareja.br2, pareja.br);
  const origen = hexAHsl("#1e40af");
  const derivado = hexAHsl(pareja.br2);
  const giro = (derivado.h - origen.h + 360) % 360;
  assert.ok(giro > 30 && giro < 40, `giro ${giro}`);
  assert.ok(derivado.l < origen.l);
  assert.equal(degradadoLegible(pareja.br, pareja.br2), true);
  assert.ok(contraste(pareja.br, "#ffffff") >= 4.5);
  assert.ok(contraste(pareja.br2, "#ffffff") >= 4.5);
});

test("oscurece un color claro hasta que el degradado admite texto blanco", () => {
  const pareja = parejaMarca("#f6e7a8");
  assert.ok(pareja);
  assert.notEqual(pareja.br, "#f6e7a8");
  assert.equal(degradadoLegible(pareja.br, pareja.br2), true);
});

test("rechaza un color que no es #rrggbb", () => {
  assert.equal(parejaMarca("azul"), null);
  assert.equal(parejaMarca("#fff"), null);
});
