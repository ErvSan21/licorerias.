"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { registrarAuditoria } from "@/lib/auth/auditoria";
import { AccesoError } from "@/lib/auth/errors";
import { usuarioEsSuperAdmin, usuarioVerificado } from "@/lib/auth/staff";
import { tiendasDelUsuario } from "@/lib/auth/tiendas";
import { createClient } from "@/lib/supabase/server";
import { destinoTrasLogin } from "@/lib/tenant";

export type EstadoLogin = { error: string | null };

export async function entrar(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const siguiente = destinoTrasLogin(String(formData.get("siguiente") ?? ""));

  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Correo o contraseña incorrectos." };

    const user = await usuarioVerificado();
    if (!user) return { error: "No se pudo confirmar la sesión." };

    await registrarAuditoria({
      userId: user.id,
      accion: "login",
      detalle: { metodo: "password" },
    });

    const tiendas = await tiendasDelUsuario(user.id);
    const superAdmin = await usuarioEsSuperAdmin(user.id);
    if (siguiente === "/super" && superAdmin) redirect("/super");
    if (siguiente && siguiente.startsWith("/t/")) {
      const slug = siguiente.slice("/t/".length).split("/")[0];
      if (tiendas.some((tienda) => tienda.slug === slug)) redirect(siguiente);
    }
    if (tiendas.length === 0 && superAdmin) redirect("/super");
    if (tiendas.length === 1 && !superAdmin) redirect(`/t/${tiendas[0].slug}/panel`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return { error: "Falta la configuración de Supabase en el servidor." };
    }
    throw error;
  }

  redirect("/login");
}

export async function salir() {
  const supabase = await createClient();
  const user = await usuarioVerificado();
  if (user) {
    await registrarAuditoria({ userId: user.id, accion: "logout" });
  }
  await supabase.auth.signOut();
  redirect("/login");
}
