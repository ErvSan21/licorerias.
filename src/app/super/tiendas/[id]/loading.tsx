import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoTienda() {
  return (
    <EstadoCarga etiqueta="Cargando la tienda…">
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="mb-2 h-8 w-64" />
      <SkeletonText lineas={3} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </EstadoCarga>
  );
}
