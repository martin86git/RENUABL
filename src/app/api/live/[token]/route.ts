import { isLiveToken } from "@/lib/domain/design/live";
import { answer, readBody } from "@/lib/server/design-context";
import { chooseLive, liveByToken } from "@/lib/server/design-live-repo";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "This live design isn't available." }, { status: 404 });

/**
 * GET → { business, snapshot, choice, open }: the customer's live view, by the link's token alone (no sign-in), with
 * only what they may see. Opening it is noted, so the business sees they are watching.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    // Per link: a phone asks every 2 s for up to 4 hours, and several on one connection mustn't share a budget.
    if (!allow(request, `live-view:${token.slice(0, 48)}`, 4000)) return new Response(null, { status: 429 });
    const live = isLiveToken(token) ? await liveByToken(token, true) : null;
    if (!live) return gone();
    const { lat: _lat, lng: _lng, ...shown } = live;
    void _lat;
    void _lng;
    return Response.json({ ok: true, ...shown });
  });
}

/** POST { choice }: the design the customer would like, one they were shown, while the link is open. */
export async function POST(request: Request, ctx: RouteContext<"/api/live/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "live-choose", 60)) return Response.json({ ok: false, message: "Try again in a moment." }, { status: 429 });
    if (!isLiveToken(token)) return gone();
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const choice = await chooseLive(token, read.body.choice);
    if (choice === "closed") return Response.json({ ok: false, message: "This live session has ended." }, { status: 409 });
    if (choice === null) return Response.json({ ok: false, message: "Choose one of the designs shown." }, { status: 422 });
    return Response.json({ ok: true, choice });
  });
}
