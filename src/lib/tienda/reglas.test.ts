import assert from "node:assert/strict";
import test from "node:test";

import { horarioPorDefecto } from "@/lib/sucursales/reglas";

import { abiertaEn, opcionesRecojo, reconciliarCarrito, sucursalMasCercana, telefonoDesdeConsulta } from "./reglas.ts";

const lunes = new Date("2026-09-28T15:00:00.000Z");

test("la sucursal sigue el horario de Bolivia", () => {
  const horario = horarioPorDefecto();
  assert.equal(abiertaEn(true, horario, lunes), true);
  assert.equal(abiertaEn(false, horario, lunes), false);
  assert.equal(abiertaEn(true, horario, new Date("2026-09-29T02:00:00.000Z")), false);
  assert.equal(abiertaEn(true, horario, new Date("2026-10-04T15:00:00.000Z")), false);
});

test("la sucursal más cercana ignora las que no tienen pin", () => {
  const slug = sucursalMasCercana(
    { lat: -16.5, lng: -68.15 },
    [
      { slug: "lejos", lat: -17.8, lng: -63.1 },
      { slug: "sin-pin", lat: null, lng: null },
      { slug: "cerca", lat: -16.51, lng: -68.16 },
    ],
  );
  assert.equal(slug, "cerca");
  assert.equal(sucursalMasCercana({ lat: 0, lng: 0 }, [{ slug: "vacia", lat: null, lng: null }]), null);
});

test("el teléfono de la URL queda en 8 dígitos o vacío", () => {
  assert.equal(telefonoDesdeConsulta("59171234567"), "71234567");
  assert.equal(telefonoDesdeConsulta("+591 7123-4567"), "71234567");
  assert.equal(telefonoDesdeConsulta("123"), "");
  assert.equal(telefonoDesdeConsulta(null), "");
});

test("cambiar de sucursal avisa precio, agotado y producto que ya no está", () => {
  const resultado = reconciliarCarrito(
    [
      { productoId: "a", cantidad: 2, precioFinal: 10 },
      { productoId: "b", cantidad: 1, precioFinal: 8 },
      { productoId: "c", cantidad: 1, precioFinal: 5 },
    ],
    [
      { id: "a", nombre: "Paceña", precioFinal: 12, agotado: false },
      { id: "b", nombre: "Vino", precioFinal: 8, agotado: true },
    ],
  );
  assert.deepEqual(resultado.lineas, [{ productoId: "a", cantidad: 2 }]);
  assert.deepEqual(
    resultado.avisos.map((aviso) => aviso.tipo),
    ["precio", "agotado", "fuera"],
  );
});

test("el recojo programado cae dentro del horario y respeta la anticipación", () => {
  const horario = horarioPorDefecto();
  const horas = opcionesRecojo(horario, 30, lunes);
  assert.ok(horas.length > 0);
  assert.ok(horas.every((hora) => abiertaEn(true, horario, new Date(hora))));
  assert.ok(horas.every((hora) => new Date(hora).getTime() >= lunes.getTime() + 30 * 60_000));
});
