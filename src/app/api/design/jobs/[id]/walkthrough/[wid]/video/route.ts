import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { videoResponse, walkthroughFile } from "@/lib/server/design-walkthroughs";

/** GET: a walkthrough's video, for members who may see the deal (Range passed on, so it seeks). */
export async function GET(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/walkthrough/[wid]/video">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id, wid } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    const file = found ? await walkthroughFile(who.member.businessId, id, wid) : null;
    return file ? videoResponse(file, request) : new Response(null, { status: 404 });
  });
}
