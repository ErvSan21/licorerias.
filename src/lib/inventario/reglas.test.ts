import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparPorCategoria,
  csvAFilas,
  esStockBajo,
  filasACsv,
  parseCantidad,
  resumenStockBajo,
  type FilaInventario,
} from "./reglas.ts";

const filas: FilaInventario[] = [
  {
    productoId: "p1",
    nombre: "Singani",
    categoria: "Vinos",
    sucursalId: "s1",
    sucursal: "Centro",
    sucursalSlug: "centro",
    stock: 2,
    stockMinimo: 5,
    disponible: true,
    activo: true,
  },
  {
    productoId: "p2",
    nombre: "Paceña",
    categoria: "Cervezas",
    sucursalId: "s1",
    sucursal: "Centro",
    sucursalSlug: "centro",
    stock: 8,
    stockMinimo: 5,
    disponible: true,
    activo: true,
  },
  {
    productoId: "p3",
    nombre: "Huari",
    categoria: "Cervezas",
    sucursalId: "s1",
    sucursal: "Centro",
    sucursalSlug: "centro",
    stock: 5,
    stockMinimo: 5,
    disponible: true,
    activo: true,
  },
];

test("el stock bajo incluye el mínimo", () => {
  assert.equal(esStockBajo(5, 5), true);
  assert.equal(esStockBajo(6, 5), false);
});

test("agrupa por categoría y resume los bajos", () => {
  const grupos = agruparPorCategoria(filas);
  assert.deepEqual(
    grupos.map((grupo) => grupo.categoria),
    ["Cervezas", "Vinos"],
  );
  assert.equal(grupos[0].filas[0].nombre, "Huari");
  assert.deepEqual(resumenStockBajo(grupos), [
    { categoria: "Cervezas", bajos: 1 },
    { categoria: "Vinos", bajos: 1 },
  ]);
});

test("el csv conserva comas y vuelve a leerse", () => {
  const conComa: FilaInventario = {
    ...filas[0],
    nombre: 'Singani, "casa"',
    sucursal: "Centro",
    sucursalSlug: "centro",
  };
  const texto = filasACsv([conComa]);
  const leidas = csvAFilas(texto);
  assert.equal(leidas.length, 1);
  assert.equal(leidas[0].producto, 'Singani, "casa"');
  assert.equal(leidas[0].stock, 2);
  assert.equal(leidas[0].stockMinimo, 5);
  assert.equal(leidas[0].sucursal, "centro");
});

test("rechaza stock negativo y cabecera distinta", () => {
  assert.throws(
    () => csvAFilas("sucursal,categoria,producto,stock,stock_minimo\ncentro,Vinos,Singani,-1,5\n"),
    /entero/,
  );
  assert.throws(() => csvAFilas("producto,stock\nSingani,1\n"), /primera fila/);
  assert.throws(() => parseCantidad("1.5", "la cantidad"), /entero/);
  assert.throws(() => parseCantidad("-2", "la cantidad"), /entero/);
});
