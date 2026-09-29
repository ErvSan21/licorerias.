import assert from "node:assert/strict";
import { test } from "node:test";

import { capitalizar } from "./texto.ts";

test("capitalizar sube solo la primera letra", () => {
  assert.equal(capitalizar("licorería centro"), "Licorería centro");
  assert.equal(capitalizar("ñandú"), "Ñandú");
  assert.equal(capitalizar("  av. arce"), "  Av. arce");
  assert.equal(capitalizar("Ya Está"), "Ya Está");
  assert.equal(capitalizar(""), "");
});
