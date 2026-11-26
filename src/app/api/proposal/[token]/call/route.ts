import { proposalJob } from "@/lib/server/design-proposal-repo";
import { answer } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { askTimes, askedWindow, mayCallNow } from "@/lib/domain/voice-agent";
import { askedCallOf, cancelAskedCall, queueCall, ringAskedCallNow } from "@/lib/server/voice-calls";

const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const notFound = () => Response.json({ ok: false, message: "This proposal isn't available." }, { status: 404 });

/**
 * POST: "Call me" on a customer's proposal. The business's automated assistant rings the mobile on the customer's
 * record (never a number sent from the browser) to go through the proposal with them. Keyed by the link alone, like
 * the chat; only while the proposal is out, only where the business has calls on. Answers when the call will come.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/proposal/[token]/call">) {
  return answer(async () => {
    if (!allow(request, "proposal-call", 4))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429, headers: PRIVATE });
    const { token } = await ctx.params;
    const found = await proposalJob(token);
    if (!found || found.withdrawn) return notFound();
    // Now, or a time they picked from those offered (`askTimes`): only one offered right now is taken.
    const body = (await request.json().catch(() => ({}))) as { at?: unknown };
    const at = body.at === undefined || body.at === "now" ? undefined : askedWindow(body.at, new Date());
    if (at === null)
      return Response.json({ ok: false, message: "That time isn't available any more. Pick another." }, { status: 422, headers: PRIVATE });
    const r = await queueCall({
      at,
      businessId: found.businessId,
      jobId: found.jobId,
      mode: "proposal",
      asked: true,
      source: "Call me on the proposal",
    });
    if (r.result === "placed") return Response.json({ ok: true, when: r.when }, { headers: PRIVATE });
    if (r.result === "already") {
      const waiting = await askedCallOf(found.businessId, found.jobId);
      return Response.json({ ok: true, when: waiting?.when ?? "soon", already: true }, { headers: PRIVATE });
    }
    if (r.result === "no-number")
      return Response.json(
        { ok: false, message: "We don't have a mobile number for you. Write it in the chat and we'll call you." },
        { status: 422, headers: PRIVATE },
      );
    return Response.json(
      { ok: false, message: "We can't call just now. Write to us in the chat and the team will get back to you." },
      { status: 503, headers: PRIVATE },
    );
  });
}

/** GET: whether a call this customer asked for is still waiting, and when it will come, so the page shows it again. */
export async function GET(_request: Request, ctx: RouteContext<"/api/proposal/[token]/call">) {
  return answer(async () => {
    const { token } = await ctx.params;
    const found = await proposalJob(token);
    if (!found || found.withdrawn) return notFound();
    const waiting = await askedCallOf(found.businessId, found.jobId);
    const now = new Date();
    return Response.json({ ok: true, when: waiting?.when ?? null, times: askTimes(now), nowOpen: mayCallNow(now) }, { headers: PRIVATE });
  });
}

/** DELETE: the customer cancels the call they asked for, while it hasn't started. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/proposal/[token]/call">) {
  return answer(async () => {
    if (!allow(request, "proposal-call-cancel", 10))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429, headers: PRIVATE });
    const { token } = await ctx.params;
    const found = await proposalJob(token);
    if (!found || found.withdrawn) return notFound();
    const r = await cancelAskedCall(found.businessId, found.jobId);
    if (r === "cancelled") return Response.json({ ok: true }, { headers: PRIVATE });
    return Response.json(
      { ok: false, message: "There's no call waiting to cancel. It may already be ringing." },
      { status: 409, headers: PRIVATE },
    );
  });
}

/**
 * PUT: the customer has the call they asked for ring now, on the mobile on their record. Their own press, so it rings
 * outside calling hours too.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/proposal/[token]/call">) {
  return answer(async () => {
    if (!allow(request, "proposal-call-now", 4))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429, headers: PRIVATE });
    const { token } = await ctx.params;
    const found = await proposalJob(token);
    if (!found || found.withdrawn) return notFound();
    const r = await ringAskedCallNow(found.businessId, found.jobId);
    if (r === "ringing") return Response.json({ ok: true }, { headers: PRIVATE });
    if (r === "not-waiting")
      return Response.json(
        { ok: false, message: "There's no call waiting. It may already be ringing." },
        { status: 409, headers: PRIVATE },
      );
    return Response.json(
      { ok: false, message: "We couldn't ring just now. Your call is still booked for the time shown." },
      { status: 503, headers: PRIVATE },
    );
  });
}
