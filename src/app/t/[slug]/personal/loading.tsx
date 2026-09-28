import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

export default function CargandoPersonal() {
  return (
    <EstadoCarga etiqueta="Cargando personal…" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </EstadoCarga>
  );
}
