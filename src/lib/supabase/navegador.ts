"use client";

import { createBrowserClient } from "@supabase/ssr";

import { clavePublica, supabaseUrl } from "@/lib/supabase/env";

export function crearClienteNavegador() {
  const url = supabaseUrl();
  const key = clavePublica();
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
