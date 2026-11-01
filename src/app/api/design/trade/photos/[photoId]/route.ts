import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { answer, requireMember } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { tradePhoto } from "@/lib/server/design-trade-repo";

/** GET a photo of an item for sale, for a business that may see the item (anyone else: the same 404). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/trade/photos/[photoId]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { photoId } = await ctx.params;
    const photo = await tradePhoto(who.member.businessId, photoId.slice(0, 80));
    return photo ? imageResponse(photo) : new Response("Not found", { status: 404 });
  });
}
