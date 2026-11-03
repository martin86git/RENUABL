import { proposalJob } from "@/lib/server/design-proposal-repo";
import { answer } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { queueCall } from "@/lib/server/voice-calls";

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
    const r = await queueCall({
      businessId: found.businessId,
      jobId: found.jobId,
      mode: "proposal",
      asked: true,
      source: "Call me on the proposal",
    });
    if (r.result === "placed") return Response.json({ ok: true, when: r.when }, { headers: PRIVATE });
    if (r.result === "already") return Response.json({ ok: true, when: "soon", already: true }, { headers: PRIVATE });
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
