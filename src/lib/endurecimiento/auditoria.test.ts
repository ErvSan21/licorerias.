import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const acciones = [
  ["src/lib/catalogo/servicio.ts", "precio.ajuste_central"],
  ["src/lib/catalogo/servicio.ts", "precio.ajuste_propio"],
  ["src/lib/catalogo/servicio.ts", "precio.volver_todos"],
  ["src/lib/catalogo/servicio.ts", "precio.copiar"],
  ["src/lib/licencias/servicio.ts", "licencia.suspender"],
  ["src/lib/sucursales/servicio.ts", "personal.invitar"],
] as const;

test("precios masivos, suspensiones e invitaciones quedan en auditoría", () => {
  for (const [archivo, accion] of acciones) {
    const texto = readFileSync(join(raiz, archivo), "utf8");
    assert.equal(texto.includes(`accion: "${accion}"`), true, accion);
  }
});
