import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

export default function CargandoSucursales() {
  return (
    <EstadoCarga etiqueta="Cargando sucursales…" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </EstadoCarga>
  );
}
