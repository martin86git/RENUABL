import { PIXEL_GIF, isOpenToken } from "@/lib/domain/design/email-opens";
import { designAccess } from "@/lib/server/design-context";
import { recordOpen } from "@/lib/server/design-pulse-repo";

/**
 * GET the one-pixel picture in an email sent from a deal: loading it puts an open against that email. Always answers
 * with the picture (a wrong token, or the database away, changes nothing and says nothing), never cached. Loaded by
 * someone signed in to the business that sent it, it isn't counted: an open is the customer's (8 Nov 2026, Martin).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/o/[token]">) {
  const { token } = await ctx.params;
  const id = token.replace(/\.gif$/, "");
  if (isOpenToken(id)) {
    const access = await designAccess().catch(() => null);
    const ours = access?.state === "ready" ? access.member.businessId : undefined;
    await recordOpen(id, new Date(), ours).catch(() => undefined);
  }
  return new Response(PIXEL_GIF, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0", "x-robots-tag": "noindex" },
  });
}
