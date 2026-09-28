export const TIPOS_BEBIDA = [
  "Todos",
  "Singani",
  "Vinos",
  "Cervezas",
  "Rones",
  "Whisky",
  "Fernet",
  "Gin",
  "Refrescos",
] as const;

export type TipoBebida = (typeof TIPOS_BEBIDA)[number];

export function tipoDeBebida(nombre: string): TipoBebida | null {
  const texto = nombre.toLocaleLowerCase("es");
  if (/refresco|gaseosa|coca|pepsi|fanta|sprite/.test(texto)) return "Refrescos";
  if (texto.includes("singani")) return "Singani";
  if (/vino|tannat|malbec|cabernet/.test(texto)) return "Vinos";
  if (/cerveza|paceña|huari|corona/.test(texto)) return "Cervezas";
  if (/ron\b|havana/.test(texto)) return "Rones";
  if (/whisky|whiskey|old parr/.test(texto)) return "Whisky";
  if (texto.includes("fernet")) return "Fernet";
  if (/gin\b|bombay/.test(texto)) return "Gin";
  return null;
}
