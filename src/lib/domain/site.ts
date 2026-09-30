import { siteUrl } from "./sms";

/** The public address for canonical links, the sitemap and structured data. */
export const PUBLIC_SITE = "https://renuabl.com.au";

export function publicSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const url = siteUrl(env);
  return url && !url.includes("localhost") ? url : PUBLIC_SITE;
}
