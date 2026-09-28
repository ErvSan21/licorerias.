import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { AccesoError } from "@/lib/auth/errors";
import { clavePublica, supabaseUrl } from "@/lib/supabase/env";

export async function createClient() {
  const url = supabaseUrl();
  const key = clavePublica();
  if (!url || !key) {
    throw new AccesoError("configuracion");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          // En un Server Component no se pueden escribir cabeceras de caché.
          // El proxy aplica Cache-Control cuando renueva la sesión.
          void headers;
        } catch {
          // setAll desde un Server Component: el proxy renueva la sesión.
        }
      },
    },
  });
}
