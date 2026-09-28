"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { inactivarTiendaAccion } from "@/app/administracion/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAsyncAction } from "@/components/ui/use-async-action";

export function InactivarTienda({ tiendaId, nombre }: { tiendaId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const publicar = useToast();
  const { run, loading, error } = useAsyncAction(async () => {
    const resultado = await inactivarTiendaAccion(tiendaId);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.aviso;
  });

  return (
    <>
      <Button type="button" variant="peligro" size="sm" onClick={() => setAbierto(true)}>
        Inactivar
      </Button>
      <ConfirmDialog
        abierto={abierto}
        titulo={`Inactivar ${nombre}`}
        descripcion="La tienda y sus sucursales quedan suspendidas antes del vencimiento. La tienda pública muestra “Tienda no disponible”, el panel queda en solo lectura y al entrar se avisa que la licencia no está vigente."
        etiquetaConfirmar="Inactivar"
        etiquetaCargando="Inactivando…"
        peligro
        cargando={loading}
        error={error}
        alCerrar={() => {
          if (!loading) setAbierto(false);
        }}
        alConfirmar={() => {
          void run().then((hecho) => {
            if (hecho.omitida || !hecho.valor.ok) return;
            publicar("exito", hecho.valor.valor);
            setAbierto(false);
            router.refresh();
          });
        }}
      />
    </>
  );
}
