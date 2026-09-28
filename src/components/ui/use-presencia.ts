"use client";

import { useEffect, useState } from "react";

import { duraciones } from "@/components/ui/tokens";

export function usePresencia(abierto: boolean, duracionMs = duraciones.media) {
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (abierto) {
      const marco = requestAnimationFrame(() => {
        setMontado(true);
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(marco);
    }

    const marco = requestAnimationFrame(() => setVisible(false));
    const cierre = setTimeout(() => setMontado(false), duracionMs);
    return () => {
      cancelAnimationFrame(marco);
      clearTimeout(cierre);
    };
  }, [abierto, duracionMs]);

  return { montado, visible };
}
