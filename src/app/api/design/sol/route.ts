import { cleanSolInput, WHEN_LABELS, type WhenChoice, withPin } from "@/lib/domain/design/sol";
import { parseApiKey } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { askSol, chooseReminderTime, retrySol } from "@/lib/server/design-sol";
import { cleanPageContext } from "@/lib/domain/design/page-context";
import { cleanRoom } from "@/lib/domain/design/sol-rooms";
import { cleanAnswer, cleanScope } from "@/lib/domain/design/sol-induction";
import {
  answerInduction,
  answerLearn,
  chooseScope,
  forgetBusinessPref,
  setInductionStatus,
  clearSol,
  forgetSolPast,
  markSolSeen,
  resumeSol,
  solPast,
  solPastOne,
  solState,
  startNewSol,
  withSol,
} from "@/lib/server/design-sol-repo";
import { cleanKnowledgeInput, cleanTipInput, guessTopic } from "@/lib/domain/design/sol-knowledge";
import { forgetKnowledge, listKnowledge, saveKnowledge } from "@/lib/server/design-sol-knowledge-repo";
import { allow } from "@/lib/server/rate-limit";

// Sol may search and read a maker's manual before he answers.
export const maxDuration = 180;

/**
 * Sol, the member's own conversation (domain/design/sol.ts). GET → { state }, saying any reminder now due first (the
 * rail asks every minute for its count). POST { do } → { state }: "chat" { text, files } asks Sol; "seen" marks the
 * conversation seen; "retry" { page, room } asks his last answer's question again, a different way; "clear" clears it (preferences and reminders stay); "remind" { id, when } sets a reminder's time
 * from the card; "forget-reminder" { id } and "forget-pref" { id } take one off; "past", "past-open" { id }, "new",
 * "resume" { id } and "forget-past" { id } are the past conversations. Each member reads and changes only their own.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, state: await solState(who.member.businessId, who.member.email) });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 6_000_000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const body = read.body;
    const id = typeof body.id === "string" ? body.id.slice(0, 40) : "";
    const ok = (state: unknown) => Response.json({ ok: true, state });
    switch (body.do) {
      case "chat": {
        const said = cleanSolInput(body);
        if (!said) return Response.json({ ok: false, message: "Say something to Sol, or attach a smaller file." }, { status: 422 });
        if (!allow(request, "design-sol", 120))
          return Response.json({ ok: false, message: "That's a lot of questions this hour: try again shortly." }, { status: 429 });
        return ok(await askSol(who.member, said, parseApiKey(process.env.ANTHROPIC_API_KEY)));
      }
      case "retry": {
        // Try another answer: his last answer taken off and the same question asked again, a different way.
        if (!allow(request, "design-sol", 120))
          return Response.json({ ok: false, message: "That's a lot of questions this hour: try again shortly." }, { status: 429 });
        const page = cleanPageContext(body.page) ?? undefined;
        const state = await retrySol(who.member, page, parseApiKey(process.env.ANTHROPIC_API_KEY), cleanRoom(body.room));
        return state ? ok(state) : Response.json({ ok: false, message: "There's no answer of Sol's to try again." }, { status: 422 });
      }
      case "seen":
        return ok(await markSolSeen(businessId, email));
      case "clear":
        return ok(await clearSol(businessId, email));
      case "remind": {
        const when = body.when as WhenChoice;
        if (!(when in WHEN_LABELS)) return Response.json({ ok: false, message: "Choose a time." }, { status: 422 });
        const state = await chooseReminderTime(who.member, id, when);
        return state
          ? ok(state)
          : Response.json({ ok: false, message: "That reminder has gone, or that time has passed." }, { status: 404 });
      }
      case "forget-reminder":
        return ok(await withSol(businessId, email, (row) => ({ ...row, reminders: row.reminders.filter((r) => r.id !== id) })));
      case "pin": {
        // A message pinned or unpinned, found by when it was said and by whom.
        const at = typeof body.at === "string" ? body.at.slice(0, 40) : "";
        const role = body.role === "you" ? "you" : "sol";
        return ok(await withSol(businessId, email, (row) => ({ ...row, turns: withPin(row.turns, at, role, body.pinned !== false) })));
      }
      case "forget-pref":
        return ok(await withSol(businessId, email, (row) => ({ ...row, prefs: row.prefs.filter((p) => p.id !== id) })));
      // Sol's induction and what he learns in the moment (domain/design/sol-induction.ts). Never while viewing as
      // someone (the proxy refuses every change then).
      case "induction": {
        const said = cleanAnswer(body.answer);
        const key = typeof body.key === "string" ? body.key.slice(0, 40) : "";
        if (!said) return Response.json({ ok: false, message: "Choose an answer, or skip it." }, { status: 422 });
        const state = await answerInduction(businessId, email, key, said);
        return state ? ok(state) : Response.json({ ok: false, message: "There's no such question." }, { status: 404 });
      }
      case "scope": {
        const scope = cleanScope(body.scope);
        if (!scope) return Response.json({ ok: false, message: "Choose one." }, { status: 422 });
        const state = await chooseScope(businessId, email, scope);
        return state ? ok(state) : Response.json({ ok: false, message: "Only the owner sets this for everyone." }, { status: 403 });
      }
      case "induction-status": {
        const status = body.status === "later" || body.status === "done" || body.status === "pending" ? body.status : null;
        if (!status) return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
        return ok(await setInductionStatus(businessId, email, status));
      }
      case "learn": {
        const at = typeof body.at === "string" ? body.at.slice(0, 40) : "";
        const choice = cleanAnswer(body.choice, 120) ?? "";
        const state = await answerLearn(businessId, email, at, choice);
        return state ? ok(state) : Response.json({ ok: false, message: "That question has been answered." }, { status: 409 });
      }
      case "forget-business-pref": {
        const state = await forgetBusinessPref(businessId, email, id);
        return state ? ok(state) : Response.json({ ok: false, message: "Only the owner changes these." }, { status: 403 });
      }
      // Past conversations (domain/design/sol-history.ts): the list, one to read, a new chat, one picked up again,
      // one forgotten. Only ever the member's own.
      case "past":
        return Response.json({ ok: true, past: await solPast(businessId, email) });
      case "past-open": {
        const past = await solPastOne(businessId, email, id);
        return past
          ? Response.json({ ok: true, past })
          : Response.json({ ok: false, message: "That conversation has gone." }, { status: 404 });
      }
      case "new":
        return ok(await startNewSol(businessId, email));
      case "resume": {
        const state = await resumeSol(businessId, email, id);
        return state ? ok(state) : Response.json({ ok: false, message: "That conversation has gone." }, { status: 404 });
      }
      // Sol's memory (domain/design/sol-knowledge.ts), shared by the business: what he knows, one forgotten, and one of
      // his answers kept by hand (only an answer with pages under it, saved with those pages).
      case "knowledge":
        return Response.json({ ok: true, knowledge: await listKnowledge(businessId) });
      case "tip": {
        // A tip bookmarked by hand from the Technical tile's library (sol-start.tsx).
        if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
        const clean = cleanTipInput(body);
        if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 400 });
        await saveKnowledge(businessId, clean.value, email);
        return Response.json({ ok: true, knowledge: await listKnowledge(businessId) });
      }
      case "forget-knowledge":
        await forgetKnowledge(businessId, id);
        return Response.json({ ok: true, knowledge: await listKnowledge(businessId) });
      case "remember": {
        const at = typeof body.at === "string" ? body.at.slice(0, 40) : "";
        const state = await solState(businessId, email);
        const i = state.turns.findIndex((t) => t.role === "sol" && t.at === at);
        const turn = state.turns[i];
        const asked = [...state.turns.slice(0, Math.max(0, i))].reverse().find((t) => t.role === "you");
        if (!turn?.sources?.length || !asked)
          return Response.json({ ok: false, message: "Only an answer with sources under it can be kept." }, { status: 422 });
        const clean = cleanKnowledgeInput(
          {
            topic: guessTopic(`${asked.text} ${turn.text}`),
            question: asked.text,
            answer: turn.text,
            sources: turn.sources.map((x) => x.url),
          },
          new Set(turn.sources.map((x) => x.url)),
        );
        if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
        const titles = new Map(turn.sources.map((x) => [x.url, x.title]));
        const kept = await saveKnowledge(
          businessId,
          { ...clean.value, sources: clean.value.sources.map((x) => ({ ...x, title: titles.get(x.url) ?? x.title })) },
          email,
        );
        return ok(
          await withSol(businessId, email, (row) => ({
            ...row,
            turns: row.turns.map((t) =>
              t.role === "sol" && t.at === at
                ? { ...t, remembered: [...(t.remembered ?? []), { id: kept.id, question: kept.question }].slice(0, 5) }
                : t,
            ),
          })),
        );
      }
      case "forget-past":
        return Response.json({ ok: true, past: await forgetSolPast(businessId, email, id) });
      default:
        return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
    }
  });
}
