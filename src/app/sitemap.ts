import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/domain/guides";
import { publicSiteUrl } from "@/lib/domain/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = publicSiteUrl();
  // "" is the front page, RENUABL Business since 19 Nov 2026; the homeowner homepage at /homeowners stays out.
  const listed = ["", "/battery", "/learn", "/home-health", "/partners", "/offer-terms", "/privacy", "/terms", "/contact"];
  const pages = listed.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : path === "/learn" ? 0.8 : 0.4,
  }));
  const guides = GUIDES.map((g) => ({
    url: `${site}/learn/${g.slug}`,
    lastModified: g.updated,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...pages, ...guides];
}
