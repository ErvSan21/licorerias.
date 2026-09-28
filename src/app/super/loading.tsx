import { EstadoCarga, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoTiendas() {
  return (
    <EstadoCarga etiqueta="Cargando tiendas…">
      <div className="mb-4 flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-56" />
      </div>
      <SkeletonTable filas={6} columnas={4} />
    </EstadoCarga>
  );
}
