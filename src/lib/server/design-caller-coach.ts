/**
 * Server only. The business coaching its phone assistant (domain/design/coaching.ts): what it typed goes to Claude
 * speaking as the assistant, which answers and turns the feedback into notes; the notes and the conversation are kept on
 * the business's assistant (`design_caller`), business id first. One Sol answer a message (deep: it's judgement and
 * writing someone will rely on), counted as Sol's like every other answer.
 */
import { randomBytes } from "node:crypto";
import {
  COACH_SCHEMA,
  MAX_TURNS,
  applyCoaching,
  cleanCoachAnswer,
  coachPrompt,
  type CoachNote,
  type CoachTurn,
} from "@/lib/domain/design/coaching";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { parseApiKey } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { query } from "./db";
import { callerOf, coachingOf, saveCoaching } from "./design-caller-repo";
import { loadBrand } from "./design-proposal-repo";
import { withSolCredit } from "./sol-credits";

const newNoteId = () => `cn_${randomBytes(6).toString("hex")}`;

export type CoachResult = { ok: true; turns: CoachTurn[]; notes: CoachNote[] } | { ok: false; status: number; message: string };

export async function coachAssistant(o: {
  businessId: string;
  by: string;
  message: string;
  call?: { about: string; lines: { role: string; text: string }[] } | null;
}): Promise<CoachResult> {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return { ok: false, status: 503, message: "Coaching needs Claude, which isn't set up on this site yet." };
  const [caller, coaching, biz] = await Promise.all([
    callerOf(o.businessId),
    coachingOf(o.businessId),
    query<{ name: string }>(`select name from businesses where id = $1`, [o.businessId]),
  ]);
  const brand = await loadBrand(o.businessId, biz[0]?.name ?? "");
  const prompt = coachPrompt({
    assistant: caller.name,
    business: brand.name || biz[0]?.name || "",
    notes: coaching.notes,
    history: coaching.turns,
    message: o.message,
    call: o.call ?? null,
  });
  const raw = await withSolCredit(
    o.businessId,
    "chat",
    o.by,
    (ai) => readWithClaude<unknown>([], COACH_SCHEMA, prompt, apiKey, ai),
    "deep",
    "coaching",
  ).catch((e) => {
    console.error("coaching failed", e instanceof Error ? e.message : e);
    return null;
  });
  if (raw === "out") return { ok: false, status: 402, message: SOL_OUT_SHORT };
  const answer = raw ? cleanCoachAnswer(raw, coaching.notes) : null;
  if (!answer) return { ok: false, status: 502, message: `${caller.name} couldn't answer just now. Try again in a moment.` };

  const at = new Date().toISOString();
  const applied = applyCoaching(coaching.notes, answer, { at, by: o.by, from: o.call ? "call" : "chat", newId: newNoteId });
  const turns: CoachTurn[] = [
    ...coaching.turns,
    { role: "you" as const, text: o.message, at, by: o.by, ...(o.call ? { about: o.call.about } : {}) },
    { role: "assistant" as const, text: answer.reply, at, changes: applied.changes },
  ].slice(-MAX_TURNS);
  await saveCoaching(o.businessId, { notes: applied.notes, turns }, o.by);
  return { ok: true, turns, notes: applied.notes };
}
