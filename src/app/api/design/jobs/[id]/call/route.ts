import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { query } from "@/lib/server/db";
import { queueCall } from "@/lib/server/voice-calls";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

const WORDS: Record<string, string> = {
  off: "Sol's phone calls aren't switched on for your business yet. Call them yourself for now.",
  missing: "That deal isn't here.",
  "no-number": "There's no mobile on this customer's record for Sol to call.",
  already: "Sol already has a call lined up for this deal.",
  failed: "Sol couldn't line up the call just now. Try again in a moment.",
};

/**
 * POST → { message }: Sol rings the deal's customer (voice-calls.ts), from a card on Today. The number is always the one on
 * the customer's record; calls start only in calling hours, and only where calling is on for the business.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-feed-call", 20))
      return Response.json({ ok: false, message: "That's a lot of calls at once. Try again later." }, { status: 429 });
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    if (!found) return Response.json({ ok: false, message: WORDS.missing }, { status: 404 });
    const out = await query<{ n: number }>(
      `select count(*)::int as n from design_proposals where business_id = $1 and job_id = $2 and withdrawn_at is null`,
      [who.member.businessId, id],
    );
    const placed = await queueCall({
      businessId: who.member.businessId,
      jobId: id,
      mode: out[0]?.n ? "proposal" : "lead",
      asked: false,
      source: "Today",
    });
    if (placed.result === "placed") return Response.json({ ok: true, message: `Sol will call ${placed.when}.` });
    return Response.json({ ok: false, message: WORDS[placed.result] }, { status: placed.result === "off" ? 409 : 422 });
  });
}
