import { answer, requireMember } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { ticketPicture } from "@/lib/server/design-support";

/** GET a picture sent with one of the business's own support tickets; anyone else's, or none, is a 404. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/support/pictures/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const pic = /^sp_[0-9a-f]{20}$/.test(id) ? await ticketPicture(who.member.businessId, id) : null;
    return pic ? imageResponse(pic) : new Response("Not found", { status: 404 });
  });
}
