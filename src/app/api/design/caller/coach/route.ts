import { can } from "@/lib/domain/design/account";
import {
  CALL_LINES_GIVEN,
  FIXED_RULES,
  addInstructions,
  cleanMessage,
  cleanNoteText,
  instructionLines,
} from "@/lib/domain/design/coaching";
import type { DealForChat } from "@/lib/domain/design/assistant-deals";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { suburbOfAddress } from "@/lib/domain/design/deal-feed";
import { assistantDealCalls, assistantDeals } from "@/lib/server/design-call-log-repo";
import { callTranscriptsFor } from "@/lib/server/call-transcripts";
import { chatLines, fileChatAway, forgetChat, isChatId, reopenChat } from "@/lib/domain/design/coach-threads";
import { coachAssistant, newChatId, newNoteId } from "@/lib/server/design-caller-coach";
import { coachChatsOf, coachingOf, saveCoachChats, saveCoaching } from "@/lib/server/design-caller-repo";
import { ADMIN_FIXED_RULES, cleanCallerKey } from "@/lib/domain/install-call";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { allow } from "@/lib/server/rate-limit";

const PRIVATE = { "cache-control": "private, no-store" };
/** Which assistant: `?role=admin` for the post-sale assistant, which keeps its own notes and chats; else the sales one. */
const roleIn = (request: Request) => cleanCallerKey(new URL(request.url).searchParams.get("role"));
const validJob = (id: unknown): id is string => typeof id === "string" && /^job_[a-f0-9]{8,64}$/.test(id);

/** GET: how the business has coached its phone assistant (its notes and the conversation), and what never changes. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const role = roleIn(request);
    const [c, chats] = await Promise.all([coachingOf(who.member.businessId, role), coachChatsOf(who.member.businessId, role)]);
    const mayCoach = can(who.member.role, "prices", who.member.permissions);
    return Response.json(
      { ok: true, ...c, past: chatLines(chats), fixed: role === "admin" ? ADMIN_FIXED_RULES : FIXED_RULES, mayCoach },
      { headers: PRIVATE },
    );
  });
}

/**
 * POST { message, call?: { jobId, transcriptId }, deal?: { jobId } }: coach the assistant, for a member who may change settings. Feedback
 * on a call carries that call's transcript, read on the server from a deal the member may see. With { fresh: true } the
 * message starts a new chat. Or { do: "new" } (file the chat going away), { do: "open", id } (an earlier chat becomes the
 * one going) or { do: "forget", id }: the chats kept apart (domain/design/coach-threads.ts).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-coach", 60))
      return Response.json({ ok: false, message: "That's a lot of coaching at once. Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const role = roleIn(request);
    // The instructions typed as an agent is made: straight into its script as written, no answer spent.
    if (read.body.do === "script") {
      const lines = instructionLines(read.body.text);
      if (lines.length === 0) return Response.json({ ok: false, message: "Write an instruction or two, one a line." }, { status: 422 });
      const c = await coachingOf(who.member.businessId, role);
      const next = addInstructions(c.notes, lines, { at: new Date().toISOString(), by: who.member.email, newId: newNoteId });
      await saveCoaching(who.member.businessId, { notes: next.notes, turns: c.turns }, who.member.email, role);
      return Response.json({ ok: true, notes: next.notes, added: next.added.length }, { headers: PRIVATE });
    }
    if (typeof read.body.do === "string") {
      const id = who.member.businessId;
      const [c, chats] = await Promise.all([coachingOf(id, role), coachChatsOf(id, role)]);
      let next: { turns: typeof c.turns; past: typeof chats } | null = null;
      if (read.body.do === "new") next = { turns: [], past: fileChatAway(chats, c.turns, newChatId()) };
      else if (read.body.do === "open" && isChatId(read.body.id)) next = reopenChat(chats, c.turns, read.body.id, newChatId());
      else if (read.body.do === "forget" && isChatId(read.body.id)) next = { turns: c.turns, past: forgetChat(chats, read.body.id) };
      if (!next) return Response.json({ ok: false, message: "That chat isn't here any more." }, { status: 404 });
      await saveCoachChats(id, next, who.member.email, role);
      return Response.json({ ok: true, turns: next.turns, past: chatLines(next.past) }, { headers: PRIVATE });
    }
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
    // A deal picked beside the chat: the assistant is given it, with its own calls on it, from a deal the member may see.
    let deal: DealForChat | null = null;
    const d = (read.body.deal && typeof read.body.deal === "object" ? read.body.deal : null) as Record<string, unknown> | null;
    if (d && !call) {
      const found = validJob(d.jobId) ? await jobById(who.member.businessId, d.jobId, viewerOf(who.member)) : null;
      if (!found) return Response.json({ ok: false, message: "That deal isn't here." }, { status: 404 });
      const [calls, across] = await Promise.all([
        assistantDealCalls(who.member.businessId, found.job.id, role),
        assistantDeals(who.member.businessId, viewerOf(who.member), role),
      ]);
      const first = found.customer.name.split(" ")[0] || "This customer";
      deal = {
        about: `${first}'s deal`,
        customer: found.customer.name,
        deal: found.job.title,
        stage: STAGE_LABELS[found.job.stage],
        suburb: suburbOfAddress(found.job.address ?? ""),
        standing: across.find((a) => a.jobId === found.job.id)?.standing ?? "spoke",
        calls,
      };
    }
    const res = await coachAssistant({
      businessId: who.member.businessId,
      by: who.member.email,
      message,
      call,
      deal,
      fresh: read.body.fresh === true,
      role,
    });
    if (!res.ok) return Response.json({ ok: false, message: res.message }, { status: res.status });
    return Response.json({ ok: true, notes: res.notes, turns: res.turns, caller: res.caller, past: res.past }, { headers: PRIVATE });
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
    const role = roleIn(request);
    const c = await coachingOf(who.member.businessId, role);
    if (!c.notes.some((n) => n.id === read.body.id)) return Response.json({ ok: false, message: "That note isn't here." }, { status: 404 });
    const at = new Date().toISOString();
    const notes = c.notes.map((n) => (n.id === read.body.id ? { ...n, text, at, by: who.member.email } : n));
    await saveCoaching(who.member.businessId, { notes, turns: c.turns }, who.member.email, role);
    return Response.json({ ok: true, notes });
  });
}

/** DELETE ?id=: take a note away. For a member who may change settings. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const id = new URL(request.url).searchParams.get("id");
    const role = roleIn(request);
    const c = await coachingOf(who.member.businessId, role);
    const notes = c.notes.filter((n) => n.id !== id);
    await saveCoaching(who.member.businessId, { notes, turns: c.turns }, who.member.email, role);
    return Response.json({ ok: true, notes });
  });
}
