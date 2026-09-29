import Link from "next/link";

type Pestana = "productos" | "ofertas";

const PESTANAS: { id: Pestana; etiqueta: string; ruta: string }[] = [
  { id: "productos", etiqueta: "Productos", ruta: "productos" },
  { id: "ofertas", etiqueta: "Ofertas", ruta: "ofertas" },
];

/** Pestañas de la sección Productos (Productos · Ofertas): cada una es su propia página. */
export function PestanasProductos({ slug, activa }: { slug: string; activa: Pestana }) {
  return (
    <nav aria-label="Secciones de productos" className="ui-segmento">
      {PESTANAS.map((pestana) => (
        <Link
          key={pestana.id}
          href={`/t/${slug}/${pestana.ruta}`}
          aria-current={pestana.id === activa ? "page" : undefined}
          className={pestana.id === activa ? "ui-segmento-activo" : undefined}
        >
          {pestana.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
