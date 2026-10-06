import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/domain/guides";
import { publicSiteUrl } from "@/lib/domain/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = publicSiteUrl();
  const pages = ["", "/battery", "/learn", "/home-health", "/partners", "/offer-terms", "/privacy", "/terms", "/contact"].map((path) => ({
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
