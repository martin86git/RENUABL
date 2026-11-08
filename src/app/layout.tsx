import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { publicSiteUrl, searchIndexing } from "@/lib/domain/site";
import { AdTags } from "@/components/ad-tags";
import { googleAdsConfig } from "@/lib/domain/google-ads";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Brand type: Inter for UI, a light serif for editorial lines, a handwritten script for accents. The fonts are kept in
// the site (./fonts, Latin, from Google Fonts under the SIL Open Font Licence), not fetched from Google at build time:
// on 8 Nov 2026 Google's replies started breaking the build ("next/font/google queries have exactly one entry").
const inter = localFont({
  variable: "--font-inter",
  src: [{ path: "./fonts/inter-latin.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});
const serif = localFont({
  variable: "--font-serif",
  src: [
    { path: "./fonts/source-serif-4-300-latin.woff2", weight: "300", style: "normal" },
    { path: "./fonts/source-serif-4-400-latin.woff2", weight: "400", style: "normal" },
  ],
  display: "swap",
});
const script = localFont({
  variable: "--font-script",
  src: [
    { path: "./fonts/caveat-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/caveat-500-latin.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
});
// Figures in the roof designer (.theme-studio). Not preloaded: only that product uses it.
const mono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/jetbrains-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-600-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
});

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
    <html lang="en-AU" className={`${inter.variable} ${serif.variable} ${script.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/* Google Ads IDs are public; read here so short Vercel names (GADS_*) work. */}
        <AdTags googleAds={googleAdsConfig(process.env)} />
        <Analytics />
      </body>
    </html>
  );
}
