export type OfertaSucursal = {
  sucursalId: string;
  nombre: string;
  disponible: boolean;
  usaPrecioCentral: boolean;
  precioPropio: number | null;
  precioEfectivo: number | null;
};

export type ProductoLista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoria: string | null;
  imagenUrl: string | null;
  precioCentral: number;
  activo: boolean;
  ofertas: OfertaSucursal[];
};

export type CategoriaLista = {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
};

export type SucursalCatalogo = {
  id: string;
  nombre: string;
};

export type HistorialItem = {
  id: string;
  tipo: "central" | "propio";
  sucursalId: string | null;
  sucursalNombre: string | null;
  precioAnterior: number | null;
  precioNuevo: number;
  creadoEn: string;
};

export type AltaProducto = {
  nombre: string;
  descripcion: string;
  categoriaId: string | null;
  nuevaCategoria: string;
  precioCentral: number;
  sucursalIds: string[];
  activo: boolean;
};

export type ArchivoImagen = {
  bytes: Uint8Array;
  tipo: "image/jpeg" | "image/png" | "image/webp";
};
