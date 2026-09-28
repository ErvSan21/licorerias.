import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoMovimientos() {
  return (
    <EstadoCarga etiqueta="Cargando movimientos…" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-64" />
      <SkeletonText lineas={4} />
    </EstadoCarga>
  );
}
