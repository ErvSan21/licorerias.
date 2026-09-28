import { cx } from "@/components/ui/tokens";

/** Estilo del ítem activo. No monta el menú. */
export function ItemMenu({
  activo = false,
  href = "#contenido",
  children,
}: {
  activo?: boolean;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={cx("ui-item-menu", activo && "ui-item-menu-activo")} aria-current={activo ? "page" : undefined}>
      {children}
    </a>
  );
}
