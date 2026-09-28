import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoUi() {
  return (
    <EstadoCarga className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-56" />
      <SkeletonText lineas={2} />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </EstadoCarga>
  );
}
