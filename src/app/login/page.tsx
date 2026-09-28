import Link from "next/link";
import { redirect } from "next/navigation";

import { salir } from "@/app/login/actions";
import { LoginForm } from "@/app/login/login-form";
import { BotonPendiente } from "@/components/boton-pendiente";
import { AccesoError } from "@/lib/auth/errors";
import { usuarioVerificado } from "@/lib/auth/staff";
import { tiendasDelUsuario, type TiendaDelUsuario } from "@/lib/auth/tiendas";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { destinoTrasLogin, etiquetaEstado, etiquetaRol } from "@/lib/tenant";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente: siguienteCrudo } = await searchParams;
  const siguiente = destinoTrasLogin(siguienteCrudo);

  if (!supabaseConfigurado()) {
    return (
      <Marco titulo="Configuración">
        <p className="text-sm leading-6">
          Copia <code className="font-mono">.env.local.example</code> a{" "}
          <code className="font-mono">.env.local</code>, pega la URL y las claves de Supabase, y
          reinicia <code className="font-mono">npm run dev</code>.
        </p>
      </Marco>
    );
  }

  const user = await leerUsuario();
  if (user === "configuracion") {
    return (
      <Marco titulo="Configuración">
        <p className="text-sm leading-6">Falta la configuración de Supabase en el servidor.</p>
      </Marco>
    );
  }

  if (!user) {
    return (
      <Marco titulo="Entrar">
        <LoginForm siguiente={siguiente} />
      </Marco>
    );
  }

  const tiendas = await tiendasDelUsuario(user.id);
  if (siguiente && tiendas.some((tienda) => `/t/${tienda.slug}` === siguiente)) {
    redirect(siguiente);
  }
  if (tiendas.length === 1) redirect(`/t/${tiendas[0].slug}`);

  return (
    <Marco titulo="Tus tiendas">
      {tiendas.length === 0 ? (
        <p className="text-sm leading-6">Tu usuario no pertenece a ninguna tienda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tiendas.map((tienda) => (
            <li key={tienda.id}>
              <LinkTienda tienda={tienda} />
            </li>
          ))}
        </ul>
      )}
      <form action={salir} className="mt-6">
        <BotonPendiente idle="Salir" pending="Saliendo…" variant="contorno" />
      </form>
    </Marco>
  );
}

function LinkTienda({ tienda }: { tienda: TiendaDelUsuario }) {
  return (
    <Link
      href={`/t/${tienda.slug}`}
      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700"
    >
      <span className="font-medium">{tienda.nombre}</span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {etiquetaRol(tienda.rol)} · {etiquetaEstado(tienda.estado)}
      </span>
    </Link>
  );
}

async function leerUsuario() {
  try {
    return await usuarioVerificado();
  } catch (error) {
    if (error instanceof AccesoError && error.codigo === "configuracion") {
      return "configuracion" as const;
    }
    throw error;
  }
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Licorerías</p>
      <h1 className="mb-6 mt-1 text-2xl font-semibold tracking-tight">{titulo}</h1>
      {children}
    </main>
  );
}
