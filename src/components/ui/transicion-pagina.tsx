"use client";

import { usePathname } from "next/navigation";

export function TransicionPagina({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div id="contenido" tabIndex={-1} key={pathname} className="ui-entrada-pagina flex min-h-full min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
