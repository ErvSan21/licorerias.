import { EstadoCarga, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function CargandoColecciones() {
  return (
    <EstadoCarga etiqueta="Cargando colecciones…" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <SkeletonCard />
      <SkeletonCard />
    </EstadoCarga>
  );
}
