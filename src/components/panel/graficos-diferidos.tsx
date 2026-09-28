"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { Reporte } from "@/lib/reportes/reglas";

const Graficos = dynamic(() => import("./graficos-reporte").then((mod) => mod.GraficosReporte), {
  loading: () => (
    <div className="grid gap-3" aria-hidden="true">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
});

export function GraficosDiferidos({ reporte }: { reporte: Reporte }) {
  return <Graficos reporte={reporte} />;
}
