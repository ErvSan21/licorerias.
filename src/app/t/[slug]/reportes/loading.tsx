import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

export default function CargandoReportes() {
  return (
    <EstadoCarga etiqueta="Cargando reportes…" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-36" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </EstadoCarga>
  );
}
