import { redirect } from "next/navigation";

// Sin esto el build intenta generar /super/nueva por adelantado y consulta Supabase.
export const dynamic = "force-dynamic";

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect("/administracion");
}
