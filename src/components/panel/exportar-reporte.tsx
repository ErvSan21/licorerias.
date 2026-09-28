"use client";

import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/components/ui/use-async-action";

export function ExportarReporte({ href }: { href: string }) {
  const exportar = useAsyncAction(async () => {
    const respuesta = await fetch(href);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string } | null;
      throw new Error(cuerpo?.error || "No se pudo exportar. Inténtalo de nuevo.");
    }
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "reporte.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  });

  return (
    <Button
      type="button"
      variant="secundario"
      loading={exportar.loading}
      loadingLabel="Exportando…"
      success={exportar.success}
      error={exportar.error ?? false}
      onClick={() => void exportar.run()}
    >
      Exportar CSV
    </Button>
  );
}
