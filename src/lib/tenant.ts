export const SLUGS_RESERVADOS = [
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "callback",
  "cuenta",
  "dashboard",
  "dev",
  "favicon",
  "fonts",
  "health",
  "icons",
  "images",
  "login",
  "logout",
  "manifest",
  "middleware",
  "offline",
  "panel",
  "proxy",
  "public",
  "registro",
  "robots",
  "service-worker",
  "signup",
  "sitemap",
  "static",
  "super",
  "supabase",
  "sw",
  "t",
  "vercel",
  "www",
] as const;

const RESERVADOS = new Set<string>(SLUGS_RESERVADOS);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ROLES_TIENDA = ["dueno", "gerente", "vendedor"] as const;
export type RolTienda = (typeof ROLES_TIENDA)[number];

export const ESTADOS_TIENDA = ["activa", "suspendida", "cancelada"] as const;
export type EstadoTienda = (typeof ESTADOS_TIENDA)[number];

export function normalizarSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function slugValido(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function slugReservado(slug: string): boolean {
  return RESERVADOS.has(slug);
}

export function esRolTienda(valor: string): valor is RolTienda {
  return (ROLES_TIENDA as readonly string[]).includes(valor);
}

export function esEstadoTienda(valor: string): valor is EstadoTienda {
  return (ESTADOS_TIENDA as readonly string[]).includes(valor);
}

export function etiquetaRol(rol: RolTienda): string {
  if (rol === "dueno") return "Dueño";
  if (rol === "gerente") return "Gerente";
  return "Vendedor";
}

export function etiquetaEstado(estado: EstadoTienda): string {
  if (estado === "activa") return "Activa";
  if (estado === "suspendida") return "Suspendida";
  return "Cancelada";
}

/** Solo /t/{slug} con un slug usable. Evita redirigir fuera de la app. */
export function destinoTrasLogin(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith("/t/")) return null;
  if (valor.includes("\\") || valor.includes("?") || valor.includes("#") || valor.includes("//")) {
    return null;
  }

  const slug = valor.slice("/t/".length);
  if (!slug || normalizarSlug(slug) !== slug) return null;
  if (!slugValido(slug) || slugReservado(slug)) return null;
  return `/t/${slug}`;
}
