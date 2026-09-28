import { cx } from "@/components/ui/tokens";

type Tono = "neutro" | "ok" | "warn" | "danger" | "brand";

export function Tag({
  tono = "neutro",
  children,
}: {
  tono?: Tono;
  children: React.ReactNode;
}) {
  return <span className={cx("ui-tag", `ui-tag-${tono}`)}>{children}</span>;
}

export function EtiquetaOferta({ children = "OFERTA" }: { children?: React.ReactNode }) {
  return <span className="ui-tag ui-tag-oferta">{children}</span>;
}
