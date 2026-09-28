import { EstadoCarga, SkeletonTable } from "@/components/ui/skeleton";

export default function CargandoPrecios() {
  return (
    <EstadoCarga etiqueta="Cargando precios…">
      <SkeletonTable filas={5} columnas={3} />
    </EstadoCarga>
  );
}
