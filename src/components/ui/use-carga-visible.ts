"use client";

import { useEffect, useRef, useState } from "react";

import { esperaLoaderMs, minimoLoaderMs } from "@/components/ui/tokens";

export function useCargaVisible(activo: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const mostradoEn = useRef<number | null>(null);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let minimo: ReturnType<typeof setTimeout> | undefined;

    if (activo) {
      espera = setTimeout(() => {
        mostradoEn.current = Date.now();
        setVisible(true);
      }, esperaLoaderMs);
      return () => {
        if (espera) clearTimeout(espera);
      };
    }

    if (mostradoEn.current === null) {
      return;
    }

    const restante = minimoLoaderMs - (Date.now() - mostradoEn.current);
    const ocultar = () => {
      mostradoEn.current = null;
      setVisible(false);
    };
    if (restante > 0) {
      minimo = setTimeout(ocultar, restante);
      return () => {
        if (minimo) clearTimeout(minimo);
      };
    }
    ocultar();
  }, [activo]);

  return visible;
}
