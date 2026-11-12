import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { liveCallFor, steerCall } from "@/lib/server/voice-calls";
import { cleanTeamNote } from "@/lib/domain/live-call";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * GET → { call }: the phone assistant's latest call on this deal as it happens (how long it has run, what has been said),
 * for members who may see the deal. Asked every moment or two by the window that opens when the call is handed over.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/live">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const call = await liveCallFor(who.member.businessId, id);
    return Response.json({ ok: true, call }, { headers: { "cache-control": "private, no-store" } });
  });
}

const STEER_WORDS = {
  "not-on": "The call isn't on right now, so there's no one to tell.",
  failed: "That didn't reach the call. Try again in a moment.",
};

/**
 * POST { text, say } → { ok }: the team types to the assistant while it is on this deal's call, to give it an answer or
 * have it mention something (say: it says the words as typed). Members who may publish and see the deal.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/live">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-call-steer", 60))
      return Response.json({ ok: false, message: "That's a lot of notes at once. Try again in a minute." }, { status: 429 });
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const body = (await request.json().catch(() => null)) as { text?: unknown; say?: unknown } | null;
    const text = cleanTeamNote(body?.text);
    if (!text) return Response.json({ ok: false, message: "Type what to tell them first." }, { status: 400 });
    const sent = await steerCall(who.member.businessId, id, { text, say: body?.say === true });
    if (sent === "sent") return Response.json({ ok: true });
    return Response.json({ ok: false, message: STEER_WORDS[sent] }, { status: sent === "not-on" ? 409 : 502 });
  });
}
