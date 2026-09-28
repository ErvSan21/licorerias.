import "server-only";

import { cookies } from "next/headers";

import type { Staff } from "@/lib/auth/staff";
import { esUuid } from "@/lib/licencias/reglas";

import type { SucursalResumen } from "./servicio";

const COOKIE = "lic_sucursal";

/** null significa todas las sucursales. Solo el dueño puede quedar en null. */
export async function leerSeleccion(
  staff: Staff,
  sucursales: SucursalResumen[],
): Promise<string | null> {
  const jar = await cookies();
  const cruda = jar.get(COOKIE)?.value ?? "";
  const [tiendaId, valor] = cruda.split(":");
  const permitidas = new Set(sucursales.map((sucursal) => sucursal.id));
  if (tiendaId === staff.tiendaId && valor === "todas" && staff.rol === "dueno") return null;
  if (tiendaId === staff.tiendaId && valor && esUuid(valor) && permitidas.has(valor)) return valor;
  if (staff.rol === "dueno") return null;
  return sucursales[0]?.id ?? null;
}

export async function guardarSeleccion(tiendaId: string, valor: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${tiendaId}:${valor}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}
