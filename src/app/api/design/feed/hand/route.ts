import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { handToSol, takeBackFromSol } from "@/lib/server/design-handover";
import { allow } from "@/lib/server/rate-limit";

const STATUS = { missing: 404, nothing: 409, "no-email": 422, "no-day": 409, reply: 409 } as const;

/**
 * POST { jobId, do: "hand" | "take-back" } → { words }: hands the deal's next piece of work to Sol from Today, or takes
 * it back (design-handover.ts). It reaches the customer, so only a member who may publish; only a deal they may see.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-feed-hand", 60))
      return Response.json({ ok: false, message: "That's a lot at once. Try again in a moment." }, { status: 429 });
    const body = (await request.json().catch(() => null)) as { jobId?: unknown; do?: unknown } | null;
    const jobId = typeof body?.jobId === "string" && /^job_[a-f0-9]{8,64}$/.test(body.jobId) ? body.jobId : "";
    if (!jobId) return Response.json({ ok: false, message: "Which deal?" }, { status: 400 });
    const viewer = viewerOf(who.member);
    if (body?.do === "take-back") {
      const back = await takeBackFromSol(who.member, viewer, jobId);
      return back
        ? Response.json({ ok: true, words: "Taken back." })
        : Response.json({ ok: false, message: "Sol has nothing on this deal to take back." }, { status: 409 });
    }
    if (body?.do !== "hand") return Response.json({ ok: false, message: "Hand it over or take it back." }, { status: 400 });
    const r = await handToSol(who.member, viewer, jobId);
    return r.ok ? Response.json({ ok: true, words: r.words }) : Response.json({ ok: false, message: r.message }, { status: STATUS[r.why] });
  });
}
