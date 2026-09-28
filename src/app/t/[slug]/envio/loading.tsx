import { EstadoCarga, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoEnvio() {
  return (
    <EstadoCarga etiqueta="Cargando envío…" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-64 w-full" />
      <SkeletonTable filas={3} columnas={3} />
    </EstadoCarga>
  );
}
