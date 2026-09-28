import "server-only";

import { createClient } from "@supabase/supabase-js";

import { AccesoError } from "@/lib/auth/errors";
import { claveServicio, supabaseUrl } from "@/lib/supabase/env";

/** service_role se salta RLS. Solo después de verificar el token. */
export function createServiceClient() {
  const url = supabaseUrl();
  const key = claveServicio();
  if (!url || !key) {
    throw new AccesoError("configuracion");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
