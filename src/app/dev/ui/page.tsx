import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GaleriaUi } from "@/app/dev/ui/galeria";

export const metadata: Metadata = {
  title: "Sistema de interfaz",
  robots: { index: false, follow: false },
};

export default function PaginaUi() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GaleriaUi />;
}
