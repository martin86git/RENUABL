import { toVtt } from "@/lib/domain/design/walkthrough";
import { answer } from "@/lib/server/design-context";
import { dealBehindLink, shownWalkthrough } from "@/lib/server/design-walkthroughs";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET → { walkthrough: { id, seconds } | null }: the recorded walkthrough the business has shown on this proposal.
 * GET ?vtt=1 → its captions as WebVTT. Keyed only by the proposal's private link; nothing once withdrawn.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/proposal/[token]/walkthrough">) {
  return answer(async () => {
    if (!allow(request, "proposal-walkthrough", 240)) return new Response(null, { status: 429 });
    const { token } = await ctx.params;
    const deal = await dealBehindLink(token);
    const shown = deal ? await shownWalkthrough(deal.businessId, deal.jobId) : null;
    if (new URL(request.url).searchParams.get("vtt")) {
      if (!shown) return new Response(null, { status: 404 });
      return new Response(toVtt(shown.cues), {
        headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    }
    return Response.json({ ok: true, walkthrough: shown ? { id: shown.id, seconds: shown.seconds } : null });
  });
}
