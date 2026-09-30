/**
 * The public address for canonical links, robots.txt, the sitemap and
 * structured data: always the live www domain (the one Google should list),
 * whatever address a deployment happens to run on.
 */
export const PUBLIC_SITE = "https://www.renuabl.com.au";

export function publicSiteUrl(): string {
  return PUBLIC_SITE;
}

/**
 * Whether search engines may index this deployment. The production deployment
 * on Vercel always may (even while the site is in preview mode); Vercel preview
 * deployments and local builds never do. ALLOW_INDEXING=true/false overrides.
 */
export function searchIndexing(env: Record<string, string | undefined> = process.env): boolean {
  const override = env.ALLOW_INDEXING?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return env.VERCEL_ENV === "production";
}
