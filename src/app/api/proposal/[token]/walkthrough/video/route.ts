import { answer } from "@/lib/server/design-context";
import { dealBehindLink, shownWalkthrough, videoResponse } from "@/lib/server/design-walkthroughs";
import { allow } from "@/lib/server/rate-limit";

/** GET: the walkthrough's video behind a proposal link (Range passed on, so the customer can seek). */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/walkthrough/video">) {
  return answer(async () => {
    if (!allow(request, "proposal-walkthrough-video", 600)) return new Response(null, { status: 429 });
    const { token } = await ctx.params;
    const deal = await dealBehindLink(token);
    const shown = deal ? await shownWalkthrough(deal.businessId, deal.jobId) : null;
    return shown ? videoResponse(shown, request) : new Response(null, { status: 404 });
  });
}
