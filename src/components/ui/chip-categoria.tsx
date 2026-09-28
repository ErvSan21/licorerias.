import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/components/ui/tokens";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  activo?: boolean;
  children: React.ReactNode;
};

export function ChipCategoria({ activo = false, children, className, type = "button", ...resto }: Props) {
  return (
    <button
      {...resto}
      type={type}
      aria-pressed={activo}
      className={cx("ui-chip ui-boton ui-movimiento", activo && "ui-chip-activo", className)}
    >
      {children}
    </button>
  );
}
