/**
 * Sol at work in the team chat (3 Nov 2026, Martin: "implement ALL of them"). Four things, each kept small and safe:
 *
 * 1. **Chat into work**: a line in a channel that says something should happen to a deal ("Chloe's install is moving to
 *    Thursday", "note on Smith: switchboard needs an upgrade", "remind me Friday to call the Lees") gets a card from Sol
 *    offering to do it in one press. He suggests; a person presses. Nothing is changed by Sol himself.
 * 2. **Catch me up**: what happened in a channel since the member was last there, in three short parts, for them only.
 * 3. **A deal's own thread with Sol**: the member's questions about one deal, kept together on the deal (`dealTag`).
 * 4. **Who answers what**: when a question isn't Sol's to answer, he names the teammate who usually answers that kind.
 */

import { SOL_BY } from "./team-chat";

// ---------------------------------------------------------------------------
// 1. Chat into work
// ---------------------------------------------------------------------------

export const ACTION_KINDS = ["install-date", "note", "reminder"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** What Sol offers to do, kept with his line. `done`/`dismissed` say what became of it. */
export interface ChatAction {
  kind: ActionKind;
  /** The deal it's for (install date and note); a reminder is the member's own. */
  jobId?: string;
  /** The deal in words, as the card shows it: "Chloe · Solar". */
  deal?: string;
  /** The new install day, YYYY-MM-DD. */
  date?: string;
  /** The note's words, or what to be reminded of. */
  text?: string;
  /** When a reminder is due, as an instant. */
  dueAt?: string;
  /** Who it was suggested to (the person who wrote the line); only they, or someone who may see the deal, presses. */
  for: string;
  done?: { by: string; at: string };
  dismissed?: { by: string; at: string };
}

/** Words that say something should happen, so only those lines are read for an action (most chat isn't). */
const WORK_WORDS =
  /\b(mov(e|ed|ing)|reschedul\w*|push(ed)? (back|out)|bring forward|brought forward|install(ation)?s? (is|on|for)|book(ed)? (in|for)|now on|remind( me)?|note (on|for|that)|put a note|add a note|log (that|it))\b/i;

/** Whether a line said in a room might hold work for Sol to offer: a channel, a few words, and one of the words above. */
export function mayHoldWork(isChannel: boolean, text: string): boolean {
  if (!isChannel) return false;
  const t = text.trim();
  if (t.split(/\s+/).length < 4 || t.length > 1200) return false;
  return WORK_WORDS.test(t);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const words = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** The schema Sol answers in when reading a line for work (strings only: an empty one is "none"). */
export const WORK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "deal_id", "date", "when_local", "text"],
  properties: {
    action: { type: "string", enum: ["none", ...ACTION_KINDS] },
    deal_id: { type: "string", description: "The id of the deal from the list, or empty." },
    date: { type: "string", description: "For install-date: the new day as YYYY-MM-DD, or empty." },
    when_local: { type: "string", description: "For reminder: the local time as YYYY-MM-DD HH:mm, or empty." },
    text: { type: "string", description: "For note: the note's words. For reminder: what to be reminded of. Else empty." },
  },
} as const;

/** What Sol is asked when he reads a line for work. */
export function workPrompt(input: { asker: string; line: string; today: string; deals: string; context: string }): string {
  return (
    `You read the team chat of a solar business to spare them typing. ${input.asker} just wrote the line below. Today is ${input.today} (Melbourne).\n` +
    `Decide whether the line plainly says one of these should be done, and if so fill it in:\n` +
    `- install-date: a deal's installation moves to, or is booked for, a day (give the day as YYYY-MM-DD; a weekday means the next one to come).\n` +
    `- note: something about a deal that should go on its record (put the note in plain words, as the writer would).\n` +
    `- reminder: the writer wants reminding of something at a time (give the local time as YYYY-MM-DD HH:mm; a day with no time is 09:00).\n` +
    `The deal must be one from the list, matched by the customer's name or the job; if it isn't clearly one of them, or the line is a question, a maybe, or about someone else's task, answer action "none". Never invent a deal, a day or a fact. Leave every field you don't use empty.\n\n` +
    `Deals (id: customer · job · install day):\n${input.deals || "(none)"}\n\n` +
    (input.context ? `The lines before it:\n${input.context}\n\n` : "") +
    `The line: ${input.line}`
  );
}

/** Sol's reading turned into an action he may offer, or null: the deal must be one he was shown, the day real. */
export function actionFrom(
  raw: unknown,
  input: { asker: string; deals: ReadonlyMap<string, string>; dueAt: (local: string) => string | null; today: string },
): ChatAction | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = ACTION_KINDS.find((k) => k === r.action);
  if (!kind) return null;
  const forWho = input.asker.toLowerCase();
  if (kind === "reminder") {
    const text = words(r.text, 300);
    const due = input.dueAt(words(r.when_local, 20));
    if (!text || !due) return null;
    return { kind, text, dueAt: due, for: forWho };
  }
  const jobId = words(r.deal_id, 40);
  const deal = input.deals.get(jobId);
  if (!deal) return null;
  if (kind === "install-date") {
    const date = words(r.date, 10);
    if (!DAY.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date < input.today) return null;
    return { kind, jobId, deal, date, for: forWho };
  }
  const text = words(r.text, 1000);
  if (!text) return null;
  return { kind, jobId, deal, text, for: forWho };
}

const dayWords = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The card's line: what pressing it will do. */
export function actionWords(a: ChatAction): string {
  if (a.kind === "install-date") return `Move ${a.deal}'s install to ${dayWords(a.date!)}`;
  if (a.kind === "note") return `Add a note to ${a.deal}: "${a.text}"`;
  const when = a.dueAt
    ? new Date(a.dueAt).toLocaleString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Australia/Melbourne",
      })
    : "";
  return `Remind you ${when}: ${a.text}`;
}

/** What Sol says above the card. */
export const actionLead = (a: ChatAction) =>
  a.kind === "reminder"
    ? "Want me to set that reminder?"
    : a.kind === "note"
      ? "Want me to put that on the deal?"
      : "Want me to change the date?";

/** What a kept action is cleaned to when read back: anything malformed is no action at all. */
export function cleanAction(v: unknown): ChatAction | null {
  const r = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!r) return null;
  const kind = ACTION_KINDS.find((k) => k === r.kind);
  const forWho = words(r.for, 254).toLowerCase();
  if (!kind || !forWho) return null;
  const stamp = (s: unknown) => {
    const o = (s && typeof s === "object" ? s : null) as Record<string, unknown> | null;
    const by = words(o?.by, 254);
    const at = words(o?.at, 40);
    return by && at ? { by, at } : undefined;
  };
  const out: ChatAction = { kind, for: forWho };
  if (kind !== "reminder") {
    out.jobId = words(r.jobId, 40);
    out.deal = words(r.deal, 160);
    if (!out.jobId) return null;
  }
  if (kind === "install-date") {
    out.date = words(r.date, 10);
    if (!DAY.test(out.date)) return null;
  } else {
    out.text = words(r.text, 1000);
    if (!out.text) return null;
  }
  if (kind === "reminder") {
    out.dueAt = words(r.dueAt, 40);
    if (Number.isNaN(Date.parse(out.dueAt))) return null;
  }
  const done = stamp(r.done);
  const dismissed = stamp(r.dismissed);
  if (done) out.done = done;
  if (dismissed) out.dismissed = dismissed;
  return out;
}

/** Why an action can't be pressed by this person now, or null when it can. A reminder is only its writer's to set. */
export function actionRefusal(a: ChatAction, me: string): string | null {
  if (a.done) return "That's already done.";
  if (a.dismissed) return "That was set aside.";
  if (a.kind === "reminder" && a.for !== me.toLowerCase()) return "Only the person it's for can set that reminder.";
  return null;
}

// ---------------------------------------------------------------------------
// 2. Catch me up
// ---------------------------------------------------------------------------

/** Fewer than this many lines from others since the member was last here, and there's nothing to catch up on. */
export const CATCH_UP_MIN = 3;
/** The most lines a catch-up reads. */
export const CATCH_UP_MAX = 120;

export const CATCH_UP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changed", "decided", "waiting"],
  properties: {
    changed: { type: "string", description: "What happened, in one or two short sentences." },
    decided: { type: "string", description: "What was agreed or decided, or empty." },
    waiting: { type: "string", description: "What is waiting on the reader (named or tagged, or asked of everyone), or empty." },
  },
} as const;

export interface CatchUp {
  lines: number;
  changed: string;
  decided: string;
  waiting: string;
}

export function catchUpPrompt(input: { reader: string; channel: string; lines: string }): string {
  return (
    `${input.reader} has been away from the ${input.channel} channel of their solar business's team chat. Catch them up from the lines below, written since they were last there.\n` +
    `Answer in three short parts: what changed (one or two sentences), what was decided (or empty), and what is waiting on ${input.reader} in particular, because they were tagged, named or asked, or because it was asked of everyone and nobody answered (or empty).\n` +
    `Plain Australian English, short. Use first names. Never add anything the lines don't say, never a customer's phone or email.\n\n` +
    `The lines, oldest first:\n${input.lines}`
  );
}

export function cleanCatchUp(raw: unknown, lines: number): CatchUp {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { lines, changed: words(r.changed, 600) || "Nothing much.", decided: words(r.decided, 600), waiting: words(r.waiting, 600) };
}

/** The lines worth catching up on: others' lines and Sol's, never the reader's own. */
export function othersLines<T extends { by: string }>(lines: readonly T[], me: string): T[] {
  const mine = me.toLowerCase();
  return lines.filter((l) => l.by.toLowerCase() !== mine);
}

// ---------------------------------------------------------------------------
// 3. A deal's own thread with Sol
// ---------------------------------------------------------------------------

/** How a question asked from a deal names it, so Sol reads that deal first (as "#" does) and the deal keeps its thread. */
export const dealTag = (deal: { id: string; name: string }) => `#${deal.name.replace(/[()#]/g, "").trim()} (${deal.id})`;

/**
 * The member's conversation with Sol about one deal: each question asked from it (it starts with the deal's tag) and
 * the answer after it, in order, with the tag taken off the question.
 */
export function dealThread<T extends { role: "you" | "sol"; text: string }>(turns: readonly T[], jobId: string): T[] {
  const mark = `(${jobId})`;
  const out: T[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role !== "you" || !t.text.startsWith("#")) continue;
    const head = t.text.split("\n")[0];
    if (!head.includes(mark)) continue;
    const at = t.text.indexOf(mark);
    out.push({ ...t, text: t.text.slice(at + mark.length).trim() });
    const next = turns[i + 1];
    if (next?.role === "sol") out.push(next);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Who answers what
// ---------------------------------------------------------------------------

const STOP = new Set(
  "about after again also anyone anybody because been before being can't could didn't does doesn't doing done dont from have having here into it's just know like make many more most much need next only other over really should some still such than that that's their them then there these they this those through today tomorrow very want what what's when where which while will with would your yours".split(
    " ",
  ),
);

/** The words of a line that say what it is about: four letters or more, not the common ones, no tags. */
export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/@[a-z0-9._-]+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => (w.length > 5 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/** A question in a channel, by the same plain reading Sol uses to step in: ends with "?" or starts as one. */
const looksAsked = (t: string) =>
  /\?\s*$/.test(t.trim()) || /^(what|how|when|where|which|who|why|can|could|does|do|is|are|should|anyone)\b/i.test(t.trim());

/** At least this many shared topic words before someone is named as the one who usually answers. */
export const WHO_MIN_SCORE = 2;

/**
 * The teammate who usually answers questions like this one, from the room's history: for each earlier question, the
 * first other member to write after it (a reply to it counts first) is its answerer, scored by the topic words it shares
 * with this question. Never the asker, never Sol, only someone still in the business. Null when nobody stands out.
 */
export function whoAnswers(
  question: string,
  history: readonly { id: string; by: string; text: string; replyTo?: string | null }[],
  asker: string,
  members: readonly string[],
): string | null {
  const want = topicWords(question);
  if (want.size < 2) return null;
  const me = asker.toLowerCase();
  const here = new Set(members.map((m) => m.toLowerCase()));
  const scores = new Map<string, number>();
  history.forEach((q, i) => {
    if (q.by === SOL_BY || !looksAsked(q.text)) return;
    const shared = [...topicWords(q.text)].filter((w) => want.has(w)).length;
    if (!shared) return;
    const reply =
      history.find((l) => l.replyTo === q.id && l.by !== SOL_BY && l.by.toLowerCase() !== q.by.toLowerCase()) ??
      history.slice(i + 1, i + 6).find((l) => l.by !== SOL_BY && l.by.toLowerCase() !== q.by.toLowerCase());
    if (!reply) return;
    const who = reply.by.toLowerCase();
    if (who === me || !here.has(who)) return;
    scores.set(who, (scores.get(who) ?? 0) + shared);
  });
  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= WHO_MIN_SCORE ? best[0] : null;
}

/** What Sol says when he hands a question to a teammate: tagging them so they're told. */
export const handOffLine = (handle: string, name: string) =>
  `@${handle} usually answers these. ${name.split(" ")[0]}, can you help with this one?`;
