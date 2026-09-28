export const CLAVES_PRECIO = ["mensual", "trimestral", "anual", "demo"] as const;
export type ClavePrecio = (typeof CLAVES_PRECIO)[number];

export type PreciosSuscripcion = Record<ClavePrecio, number>;

export type UsuarioOrganizacion = {
  miembroId: string;
  userId: string;
  correo: string | null;
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
