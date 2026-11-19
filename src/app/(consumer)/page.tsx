import type { Metadata } from "next";
import { SalesPage } from "@/components/design/sales-page";
import { jsonLdHtml, siteJsonLd } from "@/lib/domain/seo";
import { publicSiteUrl } from "@/lib/domain/site";
import { designAccess } from "@/lib/server/design-context";

export const metadata: Metadata = {
  title: { absolute: "RENUABL Business: for solar retailers and installers" },
  description: "Design, quote, sell, approve, book, order, install and get paid, in one place built for Australian solar businesses.",
  alternates: { canonical: "/" },
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
