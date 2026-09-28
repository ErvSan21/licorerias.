import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relativo = specifier.slice(2);
    const base = join(process.cwd(), "src", relativo);
    const archivo = existsSync(`${base}.ts`) ? `${base}.ts` : base;
    return nextResolve(pathToFileURL(archivo).href, context);
  }
  return nextResolve(specifier, context);
}
