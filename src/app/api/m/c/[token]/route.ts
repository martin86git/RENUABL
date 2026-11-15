import { publicSiteUrl } from "@/lib/domain/site";
import { dbConfigured } from "@/lib/server/db";
import { recordClick } from "@/lib/server/marketing-send";

/**
 * GET a link in a RENUABL marketing email (?l=<its index>): counts the click and goes on to the email's own link.
 * Only a link that email holds: an unknown token or index goes to the home page, so this is never an open redirect.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/m/c/[token]">) {
  const { token } = await ctx.params;
  const index = Number(new URL(request.url).searchParams.get("l"));
  let to: string | null = null;
  if (dbConfigured() && /^[0-9a-f]{40}$/.test(token) && Number.isInteger(index) && index >= 0 && index < 50)
    to = await recordClick(token, index).catch(() => null);
  return new Response(null, {
    status: 302,
    headers: { location: to ?? publicSiteUrl(), "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex" },
  });
}
