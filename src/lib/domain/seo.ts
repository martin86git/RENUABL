/**
 * Search and sharing: the home page's title and description, and the
 * structured data Google reads (who RENUABL is, the site, breadcrumbs). Only
 * facts we can stand behind: no ratings, reviews or "best/first" claims.
 */
import { LEGAL } from "./legal";
import { LAUNCH_MARKET } from "./market";

export const HOME_TITLE = "Solar and batteries in Melbourne, sized to your bill";
export const HOME_DESCRIPTION = `Upload your power bill and see one solar and battery system sized for your ${LAUNCH_MARKET.name} home, priced with rebates, in about two minutes. Reserving is free.`;

/** Organization + WebSite for the home page. */
export function siteJsonLd(site: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "RENUABL",
      legalName: LEGAL.company,
      url: site,
      email: LEGAL.email,
      areaServed: { "@type": "State", name: LAUNCH_MARKET.name },
      description: "Solar and battery systems sized from your electricity bill, installed by accredited local installation partners.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "RENUABL",
      url: site,
      inLanguage: "en-AU",
    },
  ];
}

/** Home › Learn with Revo › guide. */
export function breadcrumbJsonLd(site: string, trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${site}${t.path}` })),
  };
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
