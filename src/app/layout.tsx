import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { ProgressBar } from "@/components/ui/progress-bar";
import { ProveedorToast } from "@/components/ui/toast";
import { TransicionPagina } from "@/components/ui/transicion-pagina";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Licorerías",
  description: "Panel de la tienda",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1424" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=performance.measure.bind(performance);performance.measure=function(){try{return m.apply(performance,arguments)}catch(e){if(!e||String(e.message).indexOf('negative time stamp')===-1)throw e}}}catch(e){}",
          }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[max(1rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-[12px] focus:bg-[var(--sf)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--tx)]"
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