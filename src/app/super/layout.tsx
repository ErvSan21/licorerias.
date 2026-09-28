import { redirect } from "next/navigation";

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect("/administracion");
}
