export const CLAVES_PRECIO = ["mensual", "trimestral", "anual", "demo"] as const;
export type ClavePrecio = (typeof CLAVES_PRECIO)[number];

export type PreciosSuscripcion = Record<ClavePrecio, number>;

export type UsuarioOrganizacion = {
  miembroId: string;
  userId: string;
  correo: string | null;
  /** "Nombre Apellido" del perfil; null si todavía no lo completó. */
  nombre: string | null;
  rol: "dueno" | "gerente" | "vendedor";
  activo: boolean;
  tiendaId: string;
  tiendaNombre: string;
};

export function etiquetaTipo(rol: UsuarioOrganizacion["rol"]): string {
  if (rol === "dueno") return "Admin";
  if (rol === "vendedor") return "Ventas";
  return "Gerente";
}

// "Licorería Don Pepe" → "licoreria-don-pepe". Con sufijo: "licoreria-don-pepe-2".
export function slugDeTienda(nombre: string, sufijo = 1): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "tienda";
  return sufijo > 1 ? `${base}-${sufijo}` : base;
}

export function fechaAlta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}
