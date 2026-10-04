import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Source_Serif_4 } from "next/font/google";
import { publicSiteUrl, searchIndexing } from "@/lib/domain/site";
import { AdTags } from "@/components/ad-tags";
import "./globals.css";

// Brand type: Inter for UI, a light serif for editorial lines, a handwritten script for accents.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400"] });
const script = Caveat({ variable: "--font-script", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: { default: "RENUABL — Renewable energy on your terms", template: "%s · RENUABL" },
  description: "Solar and batteries, sized to your bill. One system made for your home, one installer, one price.",
  // Keep Vercel preview deployments (not the live site) out of search results.
  robots: searchIndexing() ? undefined : { index: false, follow: false },
  openGraph: { type: "website", siteName: "RENUABL", locale: "en_AU" },
  twitter: { card: "summary_large_image" },
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
        <AdTags />
      </body>
    </html>
  );
}
