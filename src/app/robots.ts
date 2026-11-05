import type { MetadataRoute } from "next";
import { BUSINESS_LINK_SHOWN, BUSINESS_PATHS } from "@/lib/domain/business-link";
import { publicSiteUrl, searchIndexing } from "@/lib/domain/site";

/** Production allows every crawler (private areas aside) and lists the sitemap; other deployments stay out of search. */
export default function robots(): MetadataRoute.Robots {
  if (!searchIndexing()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/installer",
        "/admin",
        "/api/",
        "/my",
        "/start",
        "/login",
        "/deposit",
        "/demo",
        "/brief",
        "/p/",
        "/pickup/",
        "/u/",
        "/job/",
        "/live/",
        // RENUABL Business, until it launches (business-link.ts).
        ...(BUSINESS_LINK_SHOWN ? [] : BUSINESS_PATHS),
      ],
    },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
