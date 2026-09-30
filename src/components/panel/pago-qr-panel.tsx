"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CargarImagen } from "@/components/ui/cargar-imagen";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";

/** Imagen del QR de cobro: la ve el cliente cuando elige pagar con QR. */
export function PagoQrPanel({ slug, actual, lectura }: { slug: string; actual: string | null; lectura: boolean }) {
  const router = useRouter();
  const publicar = useToast();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [quitar, setQuitar] = useState(false);
  const cambio = archivo != null || (quitar && actual != null);
  const guardar = useAsyncAction(async () => {
    const datos = new FormData();
    if (archivo) datos.set("qr", archivo);
    if (quitar && !archivo) datos.set("quitar", "1");
    const respuesta = await fetch(`/api/t/${slug}/pagos/qr`, { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => null)) as { qrUrl?: string | null; error?: string } | null;
    if (!respuesta.ok) throw new Error(cuerpo?.error || "No se pudo guardar el QR.");
    return cuerpo?.qrUrl ? "QR guardado. Ya aparece al pagar con QR." : "QR quitado.";
  });

  return (
    <section className="dashboard-tarjeta flex flex-col gap-3" aria-labelledby="pago-qr">
      <div>
        <h3 id="pago-qr">QR</h3>
        <p className="text-sm text-[var(--mu)]">
          Sube la imagen del QR de tu banco. El cliente la ve al elegir pagar con QR y el pedido llega como
          “Verificar pago”.
        </p>
      </div>
      <CargarImagen
        actual={quitar ? null : actual}
        etiqueta="Adjuntar imagen del QR"
        deshabilitado={lectura}
        onChange={(nuevo) => {
          setArchivo(nuevo);
          if (nuevo) setQuitar(false);
        }}
        alQuitarActual={actual ? () => setQuitar(true) : undefined}
      />
      {lectura ? null : (
        <Button
          type="button"
          disabled={!cambio}
          loading={guardar.loading}
          loadingLabel="Guardando…"
          success={guardar.success}
          error={guardar.error ?? false}
          onClick={() => {
            void guardar.run().then((hecho) => {
              if (hecho.omitida || !hecho.valor.ok) return;
              setArchivo(null);
              setQuitar(false);
              publicar("exito", hecho.valor.valor);
              router.refresh();
            });
          }}
        >
          Guardar QR
        </Button>
      )}
    </section>
  );
}
