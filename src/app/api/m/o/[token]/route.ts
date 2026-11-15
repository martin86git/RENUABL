import { PIXEL_GIF } from "@/lib/domain/design/email-opens";
import { dbConfigured } from "@/lib/server/db";
import { recordOpen } from "@/lib/server/marketing-send";

/** GET the one-pixel picture in a RENUABL marketing email: counts an open on that send. Always the picture, never cached. */
export async function GET(_request: Request, ctx: RouteContext<"/api/m/o/[token]">) {
  const { token } = await ctx.params;
  if (dbConfigured() && /^[0-9a-f]{40}$/.test(token)) await recordOpen(token).catch(() => undefined);
  return new Response(PIXEL_GIF, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0", "x-robots-tag": "noindex" },
  });
}
