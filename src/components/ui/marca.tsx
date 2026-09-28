import type { ReactNode } from "react";

import { estiloMarca } from "@/components/ui/tema";

export function Marca({
  color,
  children,
  className,
}: {
  color?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div style={estiloMarca(color)} className={className}>
      {children}
    </div>
  );
}
