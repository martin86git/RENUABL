import type { MetadataRoute } from "next";
import { publicSiteUrl, searchIndexing } from "@/lib/domain/site";

/** Production allows every crawler (private areas aside) and lists the sitemap; other deployments stay out of search. */
export default function robots(): MetadataRoute.Robots {
  if (!searchIndexing()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/installer", "/admin", "/api/", "/my", "/start", "/login", "/deposit", "/demo", "/brief"],
    },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
