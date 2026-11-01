import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { answer, requireMember } from "@/lib/server/design-context";
import { listingPictureFor } from "@/lib/server/design-marketplace-repo";

/** GET → the listing's roof picture (a PNG, the roof sharp and everything round it blurred), to a business that may see the listing. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/marketplace/[id]/picture">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const png = await listingPictureFor(who.member.businessId, id.slice(0, 80));
    if (!png) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  });
}
