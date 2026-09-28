import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoWhatsapp() {
  return (
    <EstadoCarga etiqueta="Cargando WhatsApp…" className="flex max-w-lg flex-col gap-3">
      <Skeleton className="h-8 w-40" />
      <SkeletonText lineas={2} />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-36" />
    </EstadoCarga>
  );
}
