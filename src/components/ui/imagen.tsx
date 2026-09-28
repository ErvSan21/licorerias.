"use client";

import { useState } from "react";

import { cx } from "@/components/ui/tokens";

export function ImagenConCarga({
  src,
  alt,
  width = 640,
  height = 480,
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [lista, setLista] = useState(false);

  return (
    <span className={cx("ui-imagen relative block overflow-hidden", className)}>
      <span aria-hidden="true" className={cx("ui-skeleton ui-movimiento absolute inset-0", lista && "opacity-0")} />
      {/* La spec pide loading=lazy y un fundido al terminar; next/image no expone ese contrato igual. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLista(true)}
        className={cx(
          "relative h-full w-full object-cover opacity-0 transition-opacity duration-[var(--ui-duracion-media)] ease-[var(--ui-ease)]",
          lista && "opacity-100",
        )}
      />
    </span>
  );
}
