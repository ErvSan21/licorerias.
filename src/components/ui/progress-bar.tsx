"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useCargaVisible } from "@/components/ui/use-carga-visible";

export function ProgressBar() {
  const pathname = usePathname();
  const [origen, setOrigen] = useState<string | null>(null);
  const pendiente = origen !== null && origen === pathname;
  const visible = useCargaVisible(pendiente);

  useEffect(() => {
    function alClic(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destino = event.target;
      if (!(destino instanceof Element)) return;
      const ancla = destino.closest("a");
      if (!ancla || ancla.target === "_blank" || ancla.hasAttribute("download")) return;
      const href = ancla.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setOrigen(pathname);
      window.setTimeout(() => {
        setOrigen((actual) => (actual === pathname ? null : actual));
      }, 8000);
    }

    document.addEventListener("click", alClic);
    return () => document.removeEventListener("click", alClic);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="ui-progreso-pista" role="progressbar" aria-label="Cargando página">
      <div className="ui-progreso-barra ui-movimiento" />
    </div>
  );
}
