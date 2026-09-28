import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { ProgressBar } from "@/components/ui/progress-bar";
import { ProveedorToast } from "@/components/ui/toast";
import { TransicionPagina } from "@/components/ui/transicion-pagina";

import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Licorerías",
  description: "Panel de la tienda",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[max(1rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-900 dark:focus:bg-zinc-950 dark:focus:text-zinc-100"
        >
          Saltar al contenido
        </a>
        <ProveedorToast>
          <ProgressBar />
          <TransicionPagina>{children}</TransicionPagina>
        </ProveedorToast>
      </body>
    </html>
  );
}