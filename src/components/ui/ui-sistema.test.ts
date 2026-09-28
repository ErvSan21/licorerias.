import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { activarBoton, crearGuardiaAccion } from "./async-guard.ts";
import { duraciones, easing, esperaLoaderMs } from "./tokens.ts";

const css = readFileSync(new URL("../../app/ui.css", import.meta.url), "utf8");
const boton = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("./use-async-action.ts", import.meta.url), "utf8");

test("un botón en carga no dispara la acción dos veces", async () => {
  const guardia = crearGuardiaAccion();
  let ejecuciones = 0;
  let soltar: () => void = () => {};
  const espera = new Promise<void>((resolver) => {
    soltar = resolver;
  });

  const primera = guardia.ejecutar(async () => {
    ejecuciones += 1;
    await espera;
  });
  const segunda = guardia.ejecutar(async () => {
    ejecuciones += 1;
    await espera;
  });

  assert.equal(ejecuciones, 1);
  assert.equal((await segunda).omitida, true);
  assert.equal(
    activarBoton({ loading: true }, () => {
      ejecuciones += 1;
    }),
    false,
  );
  assert.equal(ejecuciones, 1);

  soltar();
  const resultado = await primera;
  assert.equal(resultado.omitida, false);
  assert.equal(ejecuciones, 1);

  await guardia.ejecutar(async () => {
    ejecuciones += 1;
  });
  assert.equal(ejecuciones, 2);
  assert.equal(boton.includes("activarBoton"), true);
  assert.equal(hook.includes("crearGuardiaAccion"), true);
});

test("prefers-reduced-motion desactiva animaciones de movimiento", () => {
  assert.equal(duraciones.rapida, 150);
  assert.equal(duraciones.media, 250);
  assert.equal(duraciones.lenta, 400);
  assert.equal(esperaLoaderMs, duraciones.rapida);
  assert.match(css, new RegExp(`--ui-duracion-rapida:\\s*${duraciones.rapida}ms`));
  assert.match(css, new RegExp(`--ui-duracion-media:\\s*${duraciones.media}ms`));
  assert.match(css, new RegExp(`--ui-duracion-lenta:\\s*${duraciones.lenta}ms`));
  assert.match(css, new RegExp(`--ui-ease:\\s*${escapar(easing)}`));

  const media = bloque(css, "@media (prefers-reduced-motion: reduce)");
  assert.match(media, /\.ui-movimiento[\s\S]*?animation:\s*none\s*!important/);
  assert.match(media, /\.ui-boton\.ui-movimiento:hover[\s\S]*?transform:\s*none\s*!important/);
  assert.match(media, /\.ui-boton\.ui-movimiento:active[\s\S]*?transform:\s*none\s*!important/);
  assert.match(media, /\.ui-dialogo[\s\S]*?transform:\s*none\s*!important/);
  assert.match(media, /\.ui-linea-avance[\s\S]*?transition:\s*none\s*!important/);
  assert.match(media, /animation:\s*ui-latido/);
  assert.doesNotMatch(media, /animation-duration:\s*0\.01ms/);

  const frames = keyframes(css);
  const sinFrames = quitarKeyframes(css);
  const latido = frames.get("ui-latido");
  assert.ok(latido);
  assert.doesNotMatch(latido, /transform|translate|rotate|scale\(/);
  assert.doesNotMatch(frames.get("ui-aparecer") ?? "", /transform|translate|rotate|scale\(/);
  assert.doesNotMatch(frames.get("ui-resalte") ?? "", /transform|translate|rotate|scale\(/);

  for (const [nombre, cuerpo] of frames) {
    if (!/transform\s*:|translate|rotate|scale\(/.test(cuerpo)) continue;
    const selectores = usosAnimacion(sinFrames, nombre);
    assert.ok(selectores.length > 0, `falta uso de ${nombre}`);
    for (const selector of selectores) {
      assert.match(selector, /\.ui-movimiento/, `${nombre} anima movimiento fuera de .ui-movimiento (${selector})`);
    }
  }
});

function escapar(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cerrarLlave(texto: string, abre: number) {
  let nivel = 0;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === "{") nivel += 1;
    else if (texto[i] === "}") {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  throw new Error("llaves sin cerrar");
}

function bloque(texto: string, marca: string) {
  const inicio = texto.indexOf(marca);
  assert.ok(inicio >= 0, marca);
  const abre = texto.indexOf("{", inicio);
  return texto.slice(abre + 1, cerrarLlave(texto, abre));
}

function keyframes(texto: string) {
  const frames = new Map<string, string>();
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  for (const match of texto.matchAll(re)) {
    const abre = match.index + match[0].length - 1;
    frames.set(match[1], texto.slice(abre + 1, cerrarLlave(texto, abre)));
  }
  return frames;
}

function quitarKeyframes(texto: string) {
  let salida = "";
  let i = 0;
  while (i < texto.length) {
    const idx = texto.indexOf("@keyframes", i);
    if (idx === -1) {
      salida += texto.slice(i);
      break;
    }
    salida += texto.slice(i, idx);
    const abre = texto.indexOf("{", idx);
    i = cerrarLlave(texto, abre) + 1;
  }
  return salida;
}

function usosAnimacion(texto: string, nombre: string) {
  const re = new RegExp(`animation(?:-name)?\\s*:\\s*${nombre}\\b`, "g");
  const selectores: string[] = [];
  for (const match of texto.matchAll(re)) {
    const antes = texto.slice(0, match.index ?? 0);
    const corte = antes.lastIndexOf("}");
    const trozo = texto.slice(corte + 1, match.index ?? 0);
    selectores.push(trozo.slice(0, trozo.lastIndexOf("{")).trim());
  }
  return selectores;
}
