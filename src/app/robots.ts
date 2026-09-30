import type { MetadataRoute } from "next";
import { PREVIEW_MODE } from "@/lib/config";
import { publicSiteUrl } from "@/lib/domain/site";

export default function robots(): MetadataRoute.Robots {
  if (PREVIEW_MODE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/installer", "/admin", "/api/", "/my", "/start"] },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
