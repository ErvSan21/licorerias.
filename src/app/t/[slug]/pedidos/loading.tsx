import { EstadoCarga, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoPedidos() {
  return (
    <EstadoCarga etiqueta="Cargando pedidos…" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-28" />
      <SkeletonTable filas={5} columnas={2} />
    </EstadoCarga>
  );
}
