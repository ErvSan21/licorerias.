import assert from "node:assert/strict";
import test from "node:test";

import { destinoTrasLogin } from "../tenant.ts";
import {
  DIAS_GRACIA_DEFECTO,
  DIAS_PRUEBA_DEFECTO,
  formatoBs,
  formatoFecha,
  hoyBolivia,
  licenciaEstaVigente,
  parseCorreo,
  parseEntero,
  parseMonto,
  sumarDias,
  vencePronto,
} from "./reglas.ts";

const base = {
  estadoTienda: "activa",
  estadoLicencia: "activa",
  vence: "2026-09-28",
  diasGracia: 3,
  hoy: "2026-09-28",
};

test("la licencia vigente respeta estado, gracia y la tienda", () => {
  assert.equal(licenciaEstaVigente(base), true);
  assert.equal(licenciaEstaVigente({ ...base, estadoLicencia: "prueba" }), true);
  assert.equal(licenciaEstaVigente({ ...base, hoy: "2026-10-01" }), true);
  assert.equal(licenciaEstaVigente({ ...base, hoy: "2026-10-02" }), false);
  assert.equal(licenciaEstaVigente({ ...base, estadoLicencia: "suspendida" }), false);
  assert.equal(licenciaEstaVigente({ ...base, estadoLicencia: "vencida" }), false);
  assert.equal(licenciaEstaVigente({ ...base, estadoTienda: "suspendida" }), false);
  assert.equal(licenciaEstaVigente({ ...base, estadoTienda: "cancelada" }), false);
  assert.equal(licenciaEstaVigente({ ...base, diasGracia: 0, hoy: "2026-09-29" }), false);
});

test("por vencer cubre hoy y los próximos 7 días", () => {
  assert.equal(vencePronto("2026-09-28", "2026-09-28"), true);
  assert.equal(vencePronto("2026-10-05", "2026-09-28"), true);
  assert.equal(vencePronto("2026-10-06", "2026-09-28"), false);
  assert.equal(vencePronto("2026-09-27", "2026-09-28"), false);
});

test("sumar días cruza de mes sin depender de la zona del servidor", () => {
  assert.equal(sumarDias("2026-09-28", 14), "2026-10-12");
  assert.equal(sumarDias("2026-12-30", 3), "2027-01-02");
});

test("montos, correos y enteros rechazan basura", () => {
  assert.equal(parseMonto("149"), 149);
  assert.equal(parseMonto("149,50"), 149.5);
  assert.equal(parseMonto("149.5"), 149.5);
  assert.equal(parseMonto("-1"), null);
  assert.equal(parseMonto("10.999"), null);
  assert.equal(parseMonto("1e2"), null);
  assert.equal(parseCorreo(" Duenio@Tienda.bo "), "duenio@tienda.bo");
  assert.equal(parseCorreo("no-es-correo"), null);
  assert.equal(parseEntero("14", 1, 90), 14);
  assert.equal(parseEntero("0", 1, 90), null);
  assert.equal(parseEntero("3", 0, 30), 3);
});

test("el dinero y la fecha salen en español de Bolivia", () => {
  assert.equal(formatoBs(149), "Bs 149,00");
  assert.match(formatoFecha("2026-09-28"), /28/);
  assert.match(formatoFecha("2026-09-28"), /2026/);
  assert.equal(hoyBolivia(new Date("2026-09-28T04:30:00.000Z")), "2026-09-28");
  assert.equal(DIAS_PRUEBA_DEFECTO, 14);
  assert.equal(DIAS_GRACIA_DEFECTO, 3);
});

test("después de entrar se puede volver al panel de la plataforma", () => {
  assert.equal(destinoTrasLogin("/super"), "/super");
  assert.equal(destinoTrasLogin("/super/tiendas"), null);
  assert.equal(destinoTrasLogin("/t/esquina"), "/t/esquina/panel");
  assert.equal(destinoTrasLogin("/t/esquina/panel"), "/t/esquina/panel");
  assert.equal(destinoTrasLogin("/t/esquina/productos"), null);
});
