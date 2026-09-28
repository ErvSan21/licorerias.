import { EstadoCarga, Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function CargandoPanel() {
  return (
    <EstadoCarga className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-12 w-full sm:max-w-40" />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-6">
        <Skeleton className="h-6 w-24" />
        <SkeletonText lineas={2} />
      </div>
    </EstadoCarga>
  );
}
