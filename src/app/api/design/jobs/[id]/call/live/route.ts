import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { callNowInstead, endAssistantCall, liveCallFor, steerCall } from "@/lib/server/voice-calls";
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

const NOW_WORDS = {
  "not-waiting": "There's no call waiting on this deal to ring now.",
  off: "Calls aren't switched on for your business.",
  failed: "The call couldn't be placed just now. It is still lined up as it was.",
};

/**
 * PUT → { ok }: ring the call that is waiting on this deal now, whatever the calling hours (14 Nov 2026, Martin: "I need
 * to be able to force the call"). Members who may publish and see the deal; never from a demo.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/live">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-call-now", 20)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const name = who.member.firstName || who.member.email.split("@")[0];
    const rung = await callNowInstead(who.member.businessId, id, { email: who.member.email, name });
    if (rung === "ringing") return Response.json({ ok: true });
    return Response.json({ ok: false, message: NOW_WORDS[rung] }, { status: rung === "failed" ? 502 : 409 });
  });
}

const END_WORDS = {
  "not-on": "The call has already ended.",
  failed: "The call couldn't be ended from here. Try again in a moment.",
};

/**
 * DELETE → { ok }: the team hangs up on the assistant's call on this deal (13 Nov 2026, Martin: in case it says something
 * I don't agree with). No more calls on that run. Members who may publish and see the deal.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call/live">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-call-end", 30)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const { id } = await ctx.params;
    if (!validId(id) || !(await jobById(who.member.businessId, id, viewerOf(who.member))))
      return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
    const name = who.member.firstName || who.member.email.split("@")[0];
    const ended = await endAssistantCall(who.member.businessId, id, { email: who.member.email, name });
    if (ended === "ended") return Response.json({ ok: true });
    return Response.json({ ok: false, message: END_WORDS[ended] }, { status: ended === "not-on" ? 409 : 502 });
  });
}
