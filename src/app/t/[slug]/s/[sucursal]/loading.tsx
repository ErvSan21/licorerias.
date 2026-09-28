import { EstadoCarga, SkeletonCard } from "@/components/ui/skeleton";

export default function CargandoSucursal() {
  return (
    <EstadoCarga etiqueta="Cargando productos…" className="mx-auto grid w-full max-w-lg grid-cols-2 gap-3 px-4 py-6">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </EstadoCarga>
  );
}
