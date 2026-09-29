import { NegocioError } from "@/lib/licencias/reglas";
import { capitalizar } from "@/lib/texto";

export { NegocioError };

export const TIPOS_MOVIMIENTO = [
  "entrada",
  "salida",
  "ajuste",
  "venta",
  "cancelacion",
  "transferencia_in",
  "transferencia_out",
] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export type FilaInventario = {
  productoId: string;
  nombre: string;
  categoria: string;
  sucursalId: string;
  sucursal: string;
  sucursalSlug: string;
  stock: number;
  stockMinimo: number;
  disponible: boolean;
  activo: boolean;
};

export type GrupoInventario = {
  categoria: string;
  bajos: number;
  filas: FilaInventario[];
};

export type FilaCsv = {
  linea: number;
  sucursal: string;
  categoria: string;
  producto: string;
  stock: number;
  stockMinimo: number;
};

const ENTERO = /^\d+$/;
const CABECERA = ["sucursal", "categoria", "producto", "stock", "stock_minimo"];

const formatoFechaIntl = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/La_Paz",
});

export function formatoFechaInventario(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return formatoFechaIntl.format(fecha);
}

export function esStockBajo(stock: number, minimo: number): boolean {
  return stock <= minimo;
}

export function etiquetaMovimiento(tipo: string): string {
  if (tipo === "entrada") return "Stock agregado";
  if (tipo === "salida") return "Salida";
  if (tipo === "ajuste") return "Ajuste";
  if (tipo === "venta") return "Venta";
  if (tipo === "cancelacion") return "Cancelación";
  if (tipo === "transferencia_in") return "Transferencia de entrada";
  if (tipo === "transferencia_out") return "Transferencia de salida";
  return tipo;
}

export function agruparPorCategoria(filas: readonly FilaInventario[]): GrupoInventario[] {
  const ordenadas = filas.toSorted((a, b) => {
    const categoria = a.categoria.localeCompare(b.categoria, "es");
    if (categoria !== 0) return categoria;
    const nombre = a.nombre.localeCompare(b.nombre, "es");
    if (nombre !== 0) return nombre;
    return a.sucursal.localeCompare(b.sucursal, "es");
  });
  const grupos: GrupoInventario[] = [];
  for (const fila of ordenadas) {
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.categoria !== fila.categoria) {
      grupos.push({ categoria: fila.categoria, bajos: 0, filas: [] });
    }
    const grupo = grupos[grupos.length - 1];
    grupo.filas.push(fila);
    if (esStockBajo(fila.stock, fila.stockMinimo)) grupo.bajos += 1;
  }
  return grupos;
}

export function resumenStockBajo(grupos: readonly GrupoInventario[]): { categoria: string; bajos: number }[] {
  return grupos.flatMap((grupo) => (grupo.bajos > 0 ? [{ categoria: grupo.categoria, bajos: grupo.bajos }] : []));
}

export function filasACsv(filas: readonly FilaInventario[]): string {
  const lineas = [
    CABECERA.join(","),
    ...filas.map((fila) =>
      [
        celda(fila.sucursalSlug),
        celda(fila.categoria),
        celda(fila.nombre),
        String(fila.stock),
        String(fila.stockMinimo),
      ].join(","),
    ),
  ];
  return `${lineas.join("\n")}\n`;
}

export function csvAFilas(texto: string): FilaCsv[] {
  const limpio = texto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!limpio) throw new NegocioError("El archivo está vacío.");
  const lineas = limpio.split("\n");
  if (lineas.length > 2001) throw new NegocioError("El archivo tiene demasiadas filas.");
  const cabecera = partirLinea(lineas[0]).map((campo) => campo.toLowerCase());
  if (cabecera.length !== CABECERA.length || cabecera.some((campo, indice) => campo !== CABECERA[indice])) {
    throw new NegocioError("La primera fila tiene que ser sucursal,categoria,producto,stock,stock_minimo.");
  }
  if (lineas.length === 1) throw new NegocioError("El archivo no tiene filas.");

  return lineas.slice(1).map((linea, indice) => {
    const numero = indice + 2;
    const campos = partirLinea(linea);
    if (campos.length !== 5) {
      throw new NegocioError(`Línea ${numero}: faltan columnas.`);
    }
    const [sucursal, categoria, producto, stock, stockMinimo] = campos;
    if (!sucursal || !producto) {
      throw new NegocioError(`Línea ${numero}: escribe la sucursal y el producto.`);
    }
    return {
      linea: numero,
      sucursal,
      categoria,
      producto,
      stock: entero(stock, numero, "stock"),
      stockMinimo: entero(stockMinimo, numero, "stock mínimo"),
    };
  });
}

export function parseCantidad(valor: unknown, etiqueta: string): number {
  const texto = String(valor ?? "").trim();
  if (!ENTERO.test(texto)) {
    throw new NegocioError(`Escribe ${etiqueta} como un número entero.`);
  }
  const numero = Number(texto);
  if (numero > 1_000_000) throw new NegocioError("La cantidad es demasiado alta.");
  return numero;
}

export function parseMotivo(valor: unknown): string {
  const motivo = String(valor ?? "").trim();
  if (motivo.length < 2 || motivo.length > 200) {
    throw new NegocioError("Escribe el motivo del movimiento.");
  }
  return capitalizar(motivo);
}

function entero(valor: string, linea: number, etiqueta: string): number {
  if (!ENTERO.test(valor)) {
    throw new NegocioError(`Línea ${linea}: el ${etiqueta} tiene que ser un entero.`);
  }
  const numero = Number(valor);
  if (numero > 1_000_000) {
    throw new NegocioError(`Línea ${linea}: el ${etiqueta} es demasiado alto.`);
  }
  return numero;
}

function celda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replaceAll('"', '""')}"`;
  return valor;
}

function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let comillas = false;
  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea[indice];
    if (comillas) {
      if (caracter === '"') {
        if (linea[indice + 1] === '"') {
          actual += '"';
          indice += 1;
        } else {
          comillas = false;
        }
      } else {
        actual += caracter;
      }
      continue;
    }
    if (caracter === '"') {
      comillas = true;
      continue;
    }
    if (caracter === ",") {
      campos.push(actual.trim());
      actual = "";
      continue;
    }
    actual += caracter;
  }
  if (comillas) throw new NegocioError("El archivo tiene comillas sin cerrar.");
  campos.push(actual.trim());
  return campos;
}
