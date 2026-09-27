import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Source_Serif_4 } from "next/font/google";
import { PreviewBanner } from "@/components/ui/preview-banner";
import { PREVIEW_MODE } from "@/lib/config";
import "./globals.css";

// Brand type: Inter for UI, a light serif for editorial lines, a handwritten script for accents.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400"] });
const script = Caveat({ variable: "--font-script", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "RENUABL — Renewable energy on your terms", template: "%s · RENUABL" },
  description: "Solar, batteries, EV charging and more. Designed for your home, made simple.",
  // Keep preview deployments out of search results.
  robots: PREVIEW_MODE ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${inter.variable} ${serif.variable} ${script.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PreviewBanner />
        {children}
      </body>
    </html>
  );
}
