import assert from "node:assert/strict";
import test from "node:test";

import {
  distanciaCalleOHaversine,
  elegirTarifa,
  haversineKm,
  permitirIp,
  resolverZona,
} from "./reglas.ts";

test("haversine da cerca de 1 km entre dos puntos de La Paz", () => {
  const km = haversineKm({ lat: -16.5, lng: -68.15 }, { lat: -16.509, lng: -68.15 });
  assert.ok(km > 0.9 && km < 1.1, String(km));
});

test("elige el primer rango que cubre la distancia", () => {
  const tarifas = [
    { hastaKm: 4, costo: 15 },
    { hastaKm: 1, costo: 7 },
    { hastaKm: 2, costo: 10 },
  ];
  assert.equal(elegirTarifa(1.2, tarifas), 10);
  assert.equal(elegirTarifa(6.1, tarifas), null);
  assert.equal(elegirTarifa(1, tarifas), 7);
});

test("una zona bloqueada gana sobre una tarifa fija", () => {
  const destino = { lat: -16.5, lng: -68.15 };
  const resultado = resolverZona(destino, [
    { tipo: "tarifa_fija", lat: -16.5, lng: -68.15, radioKm: 2, costo: 8, activa: true },
    { tipo: "bloqueada", lat: -16.5, lng: -68.15, radioKm: 1, costo: null, activa: true },
  ]);
  assert.deepEqual(resultado, { tipo: "bloqueada" });
});

test("la tarifa fija usa la zona más chica que contiene el punto", () => {
  const destino = { lat: -16.5, lng: -68.15 };
  const resultado = resolverZona(destino, [
    { tipo: "tarifa_fija", lat: -16.5, lng: -68.15, radioKm: 3, costo: 12, activa: true },
    { tipo: "tarifa_fija", lat: -16.5, lng: -68.15, radioKm: 1, costo: 5, activa: true },
  ]);
  assert.equal(resultado?.tipo, "tarifa_fija");
  if (resultado?.tipo === "tarifa_fija") assert.equal(resultado.costo, 5);
});

test("si OSRM falla se usa haversine", async () => {
  const fetcher = async () => {
    throw new Error("caido");
  };
  const resultado = await distanciaCalleOHaversine(
    { lat: -16.5, lng: -68.15 },
    { lat: -16.509, lng: -68.15 },
    fetcher as typeof fetch,
  );
  assert.equal(resultado.metodo, "haversine");
  assert.ok(resultado.km > 0.9 && resultado.km < 1.1);
});

test("la misma IP se frena al pasar el máximo", () => {
  const ip = `prueba-${Date.now()}`;
  assert.equal(permitirIp(ip, 1_000, 2, 60_000), true);
  assert.equal(permitirIp(ip, 1_100, 2, 60_000), true);
  assert.equal(permitirIp(ip, 1_200, 2, 60_000), false);
  assert.equal(permitirIp(ip, 70_000, 2, 60_000), true);
});
