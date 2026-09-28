import { EstadoCarga, Skeleton } from "@/components/ui/skeleton";

export default function CargandoAdministracion() {
  return (
    <EstadoCarga etiqueta="Cargando administración…">
      <div className="panel-kpis" aria-hidden="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </EstadoCarga>
  );
}
