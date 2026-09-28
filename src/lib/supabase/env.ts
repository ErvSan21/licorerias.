function limpia(valor: string | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  if (texto.includes("TU_PROYECTO") || texto.includes("TU_CLAVE")) return null;
  return texto;
}

export function supabaseUrl(): string | null {
  return limpia(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Clave publicable nueva, o la anon key antigua. Nunca la service role. */
export function clavePublica(): string | null {
  return (
    limpia(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    limpia(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function claveServicio(): string | null {
  return limpia(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseConfigurado(): boolean {
  return Boolean(supabaseUrl() && clavePublica() && claveServicio());
}
