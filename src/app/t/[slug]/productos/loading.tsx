import { EstadoCarga, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function CargandoProductos() {
  return (
    <EstadoCarga etiqueta="Cargando productos…" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-36" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </EstadoCarga>
  );
}
