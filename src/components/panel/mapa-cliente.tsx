"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const MapaCliente = dynamic(() => import("@/components/panel/mapa-pin").then((mod) => mod.MapaPin), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
