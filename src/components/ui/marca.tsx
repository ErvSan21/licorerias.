import type { CSSProperties, ReactNode } from "react";

import { colorTextoSobre } from "@/components/ui/tokens";

export function Marca({
  color,
  children,
  className,
}: {
  color?: string;
  children: ReactNode;
  className?: string;
}) {
  const style: CSSProperties | undefined = color
    ? {
        ["--color-primario" as string]: color,
        ["--color-sobre-primario" as string]: colorTextoSobre(color),
      }
    : undefined;

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
