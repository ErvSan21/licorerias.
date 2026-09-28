import { EstadoCarga, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoInventario() {
  return (
    <EstadoCarga etiqueta="Cargando inventario…" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-36" />
      <SkeletonTable filas={6} columnas={3} />
    </EstadoCarga>
  );
}
