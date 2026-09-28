import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoNueva() {
  return (
    <EstadoCarga etiqueta="Cargando el formulario…" className="mx-auto w-full max-w-lg">
      <Skeleton className="mb-3 h-8 w-48" />
      <SkeletonText lineas={2} />
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </EstadoCarga>
  );
}
