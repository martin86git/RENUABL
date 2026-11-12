import { can } from "@/lib/domain/design/account";
import { CALL_LINES_GIVEN, FIXED_RULES, cleanMessage, cleanNoteText } from "@/lib/domain/design/coaching";
import { callTranscriptsFor } from "@/lib/server/call-transcripts";
import { coachAssistant } from "@/lib/server/design-caller-coach";
import { coachingOf, saveCoaching } from "@/lib/server/design-caller-repo";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { allow } from "@/lib/server/rate-limit";

const PRIVATE = { "cache-control": "private, no-store" };
const validJob = (id: unknown): id is string => typeof id === "string" && /^job_[a-f0-9]{8,64}$/.test(id);

/** GET: how the business has coached its phone assistant (its notes and the conversation), and what never changes. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const c = await coachingOf(who.member.businessId);
    const mayCoach = can(who.member.role, "prices", who.member.permissions);
    return Response.json({ ok: true, ...c, fixed: FIXED_RULES, mayCoach }, { headers: PRIVATE });
  });
}

/**
 * POST { message, call?: { jobId, transcriptId } }: coach the assistant, for a member who may change settings. Feedback
 * on a call carries that call's transcript, read on the server from a deal the member may see.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-coach", 60))
      return Response.json({ ok: false, message: "That's a lot of coaching at once. Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const message = cleanMessage(read.body.message);
    if (!message) return Response.json({ ok: false, message: "Say what you'd like changed." }, { status: 422 });
    let call: { about: string; lines: { role: string; text: string }[] } | null = null;
    const c = (read.body.call && typeof read.body.call === "object" ? read.body.call : null) as Record<string, unknown> | null;
    if (c) {
      const found = validJob(c.jobId) ? await jobById(who.member.businessId, c.jobId, viewerOf(who.member)) : null;
      const t = found ? (await callTranscriptsFor(who.member.businessId, found.job.id)).find((x) => x.id === c.transcriptId) : null;
      if (!found || !t) return Response.json({ ok: false, message: "That call isn't here." }, { status: 404 });
      const day = new Date(t.at).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
      const first = found.customer.name.split(" ")[0] || "a customer";
      call = { about: `A call with ${first}, ${day}`, lines: t.lines.slice(0, CALL_LINES_GIVEN) };
    }
    const res = await coachAssistant({ businessId: who.member.businessId, by: who.member.email, message, call });
    if (!res.ok) return Response.json({ ok: false, message: res.message }, { status: res.status });
    return Response.json({ ok: true, notes: res.notes, turns: res.turns }, { headers: PRIVATE });
  });
}

/** PUT { id, text }: reword a note by hand. For a member who may change settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const text = cleanNoteText(read.body.text);
    if (!text) return Response.json({ ok: false, message: "Write the note in a few words." }, { status: 422 });
    const c = await coachingOf(who.member.businessId);
    if (!c.notes.some((n) => n.id === read.body.id)) return Response.json({ ok: false, message: "That note isn't here." }, { status: 404 });
    const at = new Date().toISOString();
    const notes = c.notes.map((n) => (n.id === read.body.id ? { ...n, text, at, by: who.member.email } : n));
    await saveCoaching(who.member.businessId, { notes, turns: c.turns }, who.member.email);
    return Response.json({ ok: true, notes });
  });
}

/** DELETE ?id=: take a note away. For a member who may change settings. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const id = new URL(request.url).searchParams.get("id");
    const c = await coachingOf(who.member.businessId);
    const notes = c.notes.filter((n) => n.id !== id);
    await saveCoaching(who.member.businessId, { notes, turns: c.turns }, who.member.email);
    return Response.json({ ok: true, notes });
  });
}
