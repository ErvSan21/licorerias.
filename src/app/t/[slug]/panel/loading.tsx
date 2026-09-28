import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoPanel() {
  return (
    <EstadoCarga etiqueta="Cargando el panel…" className="flex flex-col gap-2">
      <Skeleton className="h-6 w-24" />
      <SkeletonText lineas={2} />
    </EstadoCarga>
  );
}
