"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function BotonPendiente({
  idle,
  pending,
  variant = "solido",
}: {
  idle: string;
  pending: string;
  variant?: "solido" | "contorno";
}) {
  const { pending: ocupado } = useFormStatus();

  return (
    <Button
      type="submit"
      loading={ocupado}
      loadingLabel={pending}
      variant={variant === "contorno" ? "secundario" : "primario"}
      className="w-full"
    >
      {idle}
    </Button>
  );
}
