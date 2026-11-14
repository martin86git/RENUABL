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
import type { DealForChat } from "@/lib/domain/design/assistant-deals";
import { chatLines, fileChatAway, type CoachChatLine } from "@/lib/domain/design/coach-threads";
import { CALLER_VOICES, cleanCallerName } from "@/lib/domain/design/caller";
import { ADMIN_COACH_JOB, ADMIN_FIXED_RULES, type CallerKey } from "@/lib/domain/install-call";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { parseApiKey } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { query } from "./db";
import {
  callerOf,
  coachChatsOf,
  coachingOf,
  saveCoachChats,
  saveCoaching,
  setCallerName,
  setCallerVoice,
  type Caller,
} from "./design-caller-repo";
import { loadBrand } from "./design-proposal-repo";
import { withSolCredit } from "./sol-credits";

export const newNoteId = () => `cn_${randomBytes(6).toString("hex")}`;

export type CoachResult =
  | { ok: true; turns: CoachTurn[]; notes: CoachNote[]; caller: Caller; past: CoachChatLine[] }
  | { ok: false; status: number; message: string };

export const newChatId = () => `cc_${randomBytes(8).toString("hex")}`;

const VOICES = CALLER_VOICES.map((v) => ({ id: v.voiceId, label: v.label, words: v.words }));

export async function coachAssistant(o: {
  businessId: string;
  by: string;
  message: string;
  call?: { about: string; lines: { role: string; text: string }[] } | null;
  deal?: DealForChat | null;
  /** Start a new chat with this message: the one going is filed away with the earlier ones. */
  fresh?: boolean;
  /** Which of the business's two assistants is being talked to (the post-sale one keeps its own notes and chats). */
  role?: CallerKey;
}): Promise<CoachResult> {
  const role = o.role ?? "sales";
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return { ok: false, status: 503, message: "Coaching needs Claude, which isn't set up on this site yet." };
  const [caller, coaching, chats, biz] = await Promise.all([
    callerOf(o.businessId, role),
    coachingOf(o.businessId, role),
    coachChatsOf(o.businessId, role),
    query<{ name: string }>(`select name from businesses where id = $1`, [o.businessId]),
  ]);
  const brand = await loadBrand(o.businessId, biz[0]?.name ?? "");
  const prompt = coachPrompt({
    assistant: caller.name,
    business: brand.name || biz[0]?.name || "",
    notes: coaching.notes,
    history: o.fresh ? [] : coaching.turns,
    message: o.message,
    call: o.call ?? null,
    deal: o.deal ?? null,
    voices: VOICES,
    voiceNow: caller.voice?.voiceId ?? null,
    ...(role === "admin" ? { job: ADMIN_COACH_JOB, fixed: ADMIN_FIXED_RULES } : {}),
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
  const answer = raw
    ? cleanCoachAnswer(
        raw,
        coaching.notes,
        VOICES.map((v) => v.id),
      )
    : null;
  if (!answer) return { ok: false, status: 502, message: `${caller.name} couldn't answer just now. Try again in a moment.` };

  const at = new Date().toISOString();
  const applied = applyCoaching(coaching.notes, answer, { at, by: o.by, from: o.call ? "call" : "chat", newId: newNoteId });
  // A new name or voice asked for in the chat, checked as Settings checks them.
  const settings: string[] = [];
  let now = caller;
  if (answer.rename) {
    const name = cleanCallerName(answer.rename);
    if (name.ok && name.value !== caller.name) {
      now = await setCallerName(o.businessId, name.value, o.by, role);
      settings.push(`Name: ${name.value}`);
    } else if (!name.ok) settings.push(`Name not changed: ${name.message}`);
  }
  const voice = answer.voice ? CALLER_VOICES.find((v) => v.voiceId === answer.voice) : null;
  if (voice && voice.voiceId !== caller.voice?.voiceId) {
    now = await setCallerVoice(o.businessId, { provider: voice.provider, voiceId: voice.voiceId }, o.by, role);
    settings.push(`Voice: ${voice.label}, ${voice.words}`);
  }
  const past = o.fresh ? fileChatAway(chats, coaching.turns, newChatId()) : chats;
  const turns: CoachTurn[] = [
    ...(o.fresh ? [] : coaching.turns),
    { role: "you" as const, text: o.message, at, by: o.by, ...(o.call ? { about: o.call.about } : o.deal ? { about: o.deal.about } : {}) },
    { role: "assistant" as const, text: answer.reply, at, changes: { ...applied.changes, settings } },
  ].slice(-MAX_TURNS);
  await saveCoaching(o.businessId, { notes: applied.notes, turns }, o.by, role);
  if (o.fresh) await saveCoachChats(o.businessId, { turns, past }, o.by, role);
  return { ok: true, turns, notes: applied.notes, caller: now, past: chatLines(past) };
}
