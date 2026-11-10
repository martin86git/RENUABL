import { answer, requireMember } from "@/lib/server/design-context";
import { imageResponse } from "@/lib/server/design-images";
import { newsPicture } from "@/lib/server/industry-news";

/** GET a news story's picture (its page's preview picture, redrawn by us), for any signed-in member; else 404. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/news/[id]/image">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const pic = /^story_[0-9a-f]{16}$/.test(id) ? await newsPicture(id) : null;
    return pic ? imageResponse(pic) : new Response("Not found", { status: 404 });
  });
}
