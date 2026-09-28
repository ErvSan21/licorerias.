import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoSeguimiento() {
  return (
    <EstadoCarga etiqueta="Cargando el pedido…" className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <Skeleton className="h-8 w-40" />
      <span aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-36" />
      </span>
      <SkeletonText lineas={4} />
    </EstadoCarga>
  );
}
