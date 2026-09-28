import { EstadoCarga, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoOfertas() {
  return (
    <EstadoCarga etiqueta="Cargando ofertas…" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-16 w-full" />
      <SkeletonTable filas={4} columnas={3} />
    </EstadoCarga>
  );
}
