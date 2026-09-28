import assert from "node:assert/strict";
import test from "node:test";

import { NegocioError } from "@/lib/licencias/reglas";

import { limitarPublico, objetoSolicitud } from "./solicitud.ts";

test("un JSON que no es objeto se rechaza con el mismo mensaje", async () => {
  const lista = new Request("http://local/api/pedidos", { method: "POST", body: "[]" });
  await assert.rejects(objetoSolicitud(lista), (error: unknown) => {
    assert.ok(error instanceof NegocioError);
    assert.equal(error.message, "La solicitud no es válida.");
    return true;
  });

  const roto = new Request("http://local/api/pedidos", { method: "POST", body: "{" });
  await assert.rejects(objetoSolicitud(roto), (error: unknown) => {
    assert.ok(error instanceof NegocioError);
    assert.equal(error.message, "La solicitud no es válida.");
    return true;
  });
});

test("cada ruta pública tiene su propio límite", () => {
  const pedido = new Request("http://local/api/pedidos", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const envio = new Request("http://local/api/envio", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  for (let i = 0; i < 30; i += 1) {
    assert.equal(limitarPublico(pedido, "pedido"), null);
  }
  assert.equal(limitarPublico(pedido, "pedido")?.status, 429);
  assert.equal(limitarPublico(envio, "envio"), null);
});
