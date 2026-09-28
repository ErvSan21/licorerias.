import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoMarca() {
  return (
    <EstadoCarga etiqueta="Cargando la marca…" className="grid gap-6 lg:grid-cols-2">
      <div className="flex max-w-lg flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <SkeletonText lineas={2} />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex max-w-lg flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="size-12" />
        <Skeleton className="h-12 w-36" />
      </div>
    </EstadoCarga>
  );
}
