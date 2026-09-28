import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

export default function CargandoLogin() {
  return (
    <EstadoCarga className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mb-6 mt-2 h-8 w-32" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </EstadoCarga>
  );
}
