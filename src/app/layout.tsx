import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Source_Serif_4 } from "next/font/google";
import { PREVIEW_MODE } from "@/lib/config";
import { publicSiteUrl } from "@/lib/domain/site";
import { MetaPixel } from "@/components/meta-pixel";
import "./globals.css";

// Brand type: Inter for UI, a light serif for editorial lines, a handwritten script for accents.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400"] });
const script = Caveat({ variable: "--font-script", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: { default: "RENUABL — Renewable energy on your terms", template: "%s · RENUABL" },
  description: "Solar and batteries, sized to your bill. One system made for your home, one installer, one price.",
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
        {children}
        <MetaPixel />
      </body>
    </html>
  );
}
