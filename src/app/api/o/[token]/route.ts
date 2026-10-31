import { PIXEL_GIF, isOpenToken } from "@/lib/domain/design/email-opens";
import { recordOpen } from "@/lib/server/design-pulse-repo";

/**
 * GET the one-pixel picture in an email sent from a deal: loading it puts an open against that email. Always answers
 * with the picture (a wrong token, or the database away, changes nothing and says nothing), never cached.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/o/[token]">) {
  const { token } = await ctx.params;
  const id = token.replace(/\.gif$/, "");
  if (isOpenToken(id)) await recordOpen(id).catch(() => undefined);
  return new Response(PIXEL_GIF, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0", "x-robots-tag": "noindex" },
  });
}
