import type { Metadata } from "next";
import { SalesPage } from "@/components/design/sales-page";
import { jsonLdHtml, siteJsonLd } from "@/lib/domain/seo";
import { publicSiteUrl } from "@/lib/domain/site";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: { absolute: "RENUABL Business: for solar retailers and installers" },
  description: "Design, quote, sell, approve, book, order, install and get paid, in one place built for Australian solar businesses.",
  alternates: { canonical: "/" },
  // What a link to the front page shows in iMessage and the rest (19 Nov 2026, Martin): the headline and the share
  // picture at /og/business. Setting openGraph here replaces the site-wide one, so it repeats the site details.
  openGraph: {
    type: "website",
    siteName: "RENUABL",
    locale: "en_AU",
    title: "Solar just got a brain.",
    description: "RENUABL: the AI sales force for solar businesses.",
    url: "/",
    images: [
      { url: "/og/business", width: 1200, height: 630, alt: "Solar just got a brain. RENUABL, the AI sales force for solar businesses." },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solar just got a brain.",
    description: "RENUABL: the AI sales force for solar businesses.",
    images: ["/og/business"],
  },
};

/**
 * RENUABL's front page is RENUABL Business (19 Nov 2026, Martin: "switch www.renuabl.com.au/business with
 * www.renuabl.com.au"). It was at /business, which now sends here (next.config.ts, its ad links' utm tags kept); the
 * homeowner homepage it replaced is kept at /homeowners, out of search. Everyone sees the page, signed in or not; a
 * business already signed in gets "Open RENUABL" in place of Sign in.
 */
export default async function HomePage() {
  const access = await designAccess();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(publicSiteUrl())) }} />
      <SalesPage signedIn={access.state === "ready"} />
    </>
  );
}
