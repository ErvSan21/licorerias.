import { cx } from "@/components/ui/tokens";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("ui-skeleton ui-movimiento", className)} />;
}

export function EstadoCarga({
  children,
  className,
  etiqueta = "Cargando…",
}: {
  children: React.ReactNode;
  className?: string;
  etiqueta?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <div aria-hidden="true">{children}</div>
      <p role="status" aria-live="polite" className="sr-only">
        {etiqueta}
      </p>
    </div>
  );
}

export function SkeletonText({ lineas = 3 }: { lineas?: number }) {
  return (
    <span aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: lineas }, (_, indice) => (
        <Skeleton key={indice} className={indice === lineas - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </span>
  );
}

export function SkeletonImage({ className }: { className?: string }) {
  return <Skeleton className={cx("aspect-[4/3] w-full", className)} />;
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cx("ui-circulo h-12 w-12", className)} />;
}

export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="ui-tarjeta flex flex-col gap-3 p-4"
    >
      <SkeletonImage />
      <SkeletonText lineas={2} />
    </div>
  );
}

export function SkeletonTable({ filas = 4, columnas = 3 }: { filas?: number; columnas?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <span className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
        {Array.from({ length: columnas }, (_, columna) => (
          <Skeleton key={`cab-${columna}`} className="h-4 w-full" />
        ))}
      </span>
      {Array.from({ length: filas }, (_, fila) => (
        <span
          key={fila}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columnas }, (_, columna) => (
            <Skeleton key={`${fila}-${columna}`} className="h-10 w-full" />
          ))}
        </span>
      ))}
    </div>
  );
}
