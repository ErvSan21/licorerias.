import { cx } from "@/components/ui/tokens";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("ui-tarjeta", className)}>{children}</div>;
}
