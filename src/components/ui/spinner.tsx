import { cx } from "@/components/ui/tokens";

const TAMANOS = { sm: 16, md: 20, lg: 32 } as const;

export function Spinner({
  size = "md",
  etiqueta,
  className,
}: {
  size?: keyof typeof TAMANOS;
  etiqueta?: string;
  className?: string;
}) {
  const px = TAMANOS[size];
  return (
    <span
      className={cx("inline-flex", className ?? "text-[var(--color-primario)]")}
      role={etiqueta ? "status" : undefined}
      aria-label={etiqueta}
    >
      <svg
        className="ui-spinner ui-movimiento"
        width={px}
        height={px}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path
          d="M12 4a8 8 0 0 1 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
