/**
 * The team chat on every deal (8 Nov 2026, Martin: "the request pad next to a deal"). Each deal has its own
 * conversation for the business's own people and Sol, in place of internal notes and emails left for teammates on a
 * deal page. Everyone who may see the deal may read and write in it (the deal's viewer rules, never wider); a customer
 * never sees it, and it is a different thing from the customer's proposal chat.
 *
 * Sol writes two kinds of line in it, never a daily status:
 * - a **note**: first person, like a salesperson leaving word on where the deal is or something the team should know,
 *   only when something changed or he learned something;
 * - a **request** ("ask"): he needs a person. It carries what he wants, why (the customer's own words, with when and
 *   where they were said) and one action button, and can be marked done. Open requests count on the deal feed's
 *   "Needs you". One open request of a kind a deal.
 *
 * Pure, tested.
 */
import { handleOf } from "./mentions";

export const DEAL_LINE_MAX = 2000;
/** Lines of a deal's chat sent to the page. */
export const DEAL_LINES_SHOWN = 200;
/** Lines on the feed card's pad. */
export const PAD_LINES = 3;
/** How often an open deal chat asks for new lines. */
export const DEAL_TEAM_POLL_MS = 10_000;
/** Who Sol's lines are written by (never a member's email: it has no "@"). */
export const SOL_WRITER = "sol";

export type DealLineKind = "line" | "note" | "ask";
export type AskType = "design" | "price" | "other";

/** What a request is for, and who in the business it belongs to. */
export const ASK_TYPES: Record<AskType, { label: string; forWho: string; action: string | null }> = {
  design: { label: "Design", forWho: "for a designer", action: "Open the designer with this brief" },
  price: { label: "Price", forWho: "for whoever sets prices", action: null },
  other: { label: "Request", forWho: "for the team", action: null },
};

/** The customer's own words a request rests on, with where and when they said them. */
export interface AskQuote {
  text: string;
  /** "in the proposal chat", "on the enquiry note", "in the call notes". */
  where: string;
  /** ISO time. */
  at: string;
}

export interface DealAsk {
  type: AskType;
  /** What he wants, in a sentence. */
  want: string;
  why: AskQuote[];
  done?: { by: string; at: string };
}

export interface DealLine {
  id: string;
  jobId: string;
  /** The writer's email, or `SOL_WRITER`. */
  by: string;
  kind: DealLineKind;
  text: string;
  at: string;
  ask?: DealAsk;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/** A line's words as sent from the browser: trimmed, to `DEAL_LINE_MAX`. */
export const cleanDealWords = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, DEAL_LINE_MAX) : "");

export const isDealLineId = (id: unknown): id is string => typeof id === "string" && /^dl_[a-f0-9]{8,64}$/.test(id);

/** A request as kept, cleaned again whenever read; null when it isn't one. */
export function cleanAsk(v: unknown): DealAsk | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const type = r.type === "design" || r.type === "price" || r.type === "other" ? r.type : null;
  const want = str(r.want, 600).trim();
  if (!type || !want) return null;
  const why = (Array.isArray(r.why) ? r.why : [])
    .map((q) => {
      const x = (q ?? {}) as Record<string, unknown>;
      return { text: str(x.text, 400).trim(), where: str(x.where, 60).trim(), at: ISO.test(str(x.at, 40)) ? str(x.at, 40) : "" };
    })
    .filter((q) => q.text && q.where)
    .slice(0, 4);
  const d = (r.done ?? null) as Record<string, unknown> | null;
  const done = d && typeof d.by === "string" && ISO.test(str(d.at, 40)) ? { by: str(d.by, 200), at: str(d.at, 40) } : null;
  return { type, want, why, ...(done ? { done } : {}) };
}

/** Whether a line asks Sol. */
export const asksSolOnDeal = (text: string) => /(^|\s)@sol\b/i.test(text);

/** The requests on a deal still waiting for a person, oldest first. */
export const openAsks = (lines: readonly DealLine[]) => lines.filter((l) => l.kind === "ask" && l.ask && !l.ask.done);

/** Why an open request makes a deal need a person, for the feed's "Needs you". */
export function askNeedWords(ask: Pick<DealAsk, "type">): string {
  if (ask.type === "design") return "Sol needs a design";
  if (ask.type === "price") return "Sol needs a price";
  return "Sol needs a hand";
}

/** Where the designer opens for a design request: the deal's roof with the brief shown. */
export const briefHref = (jobId: string, lineId: string) =>
  `/design/roof?job=${encodeURIComponent(jobId)}&ask=${encodeURIComponent(lineId)}`;

/** "3 Nov", "today", "yesterday": when a customer said something, in Melbourne's days. */
export function saidWhen(iso: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "";
  if (day(at) === day(now)) return "today";
  if (day(at) === day(new Date(now.getTime() - 86_400_000))) return "yesterday";
  return at.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
}

// ---------------------------------------------------------------------------
// The design request: a deal not yet designed whose customer has said what they want
// ---------------------------------------------------------------------------

/** Words that say what a home wants from a system: what a design is built on. */
const WANT_WORDS =
  /\b(batter(y|ies)|panels?|solar|kw|kwh|ev\b|electric car|charger|backup|blackouts?|evenings?|nights?|bills?|quarter|roof|tiled?|tin|flat|north|garage|export|feed-?in|hot water|heat pump|pool|aircon|air ?con|three[- ]phase|single[- ]phase|storey|shade|tesla|powerwall|sigen|sungrow)\b/i;
/** What isn't a want: arranging a call, a voicemail. */
const NOT_A_WANT = /\b(voicemail|no answer|call back|try again|left a message)\b/i;

export interface SaidSomewhere {
  text: string;
  /** "chat" (the customer's own line in the proposal chat), "note" or "call" (on the record). */
  from: "chat" | "note" | "call";
  at: string;
}

const WHERE: Record<SaidSomewhere["from"], string> = {
  chat: "in the proposal chat",
  note: "on the deal's notes",
  call: "in the call notes",
};

/** The customer's words that say what they want, latest first, at most three; their own chat lines before our notes. */
export function wantsFrom(said: readonly SaidSomewhere[]): AskQuote[] {
  return said
    .filter((s) => WANT_WORDS.test(s.text) && !NOT_A_WANT.test(s.text))
    .sort((a, b) => ((a.from === "chat") !== (b.from === "chat") ? (a.from === "chat" ? -1 : 1) : b.at.localeCompare(a.at)))
    .slice(0, 3)
    .map((s) => ({ text: s.text.replace(/\s+/g, " ").trim().slice(0, 400), where: WHERE[s.from], at: s.at }));
}

/**
 * Sol's design request for a deal still a lead with no roof design, once the customer has said what they
 * want: the line in his words and the request. Null when there is nothing to build a design on, or it is designed.
 */
export function designAskFor(
  deal: { stage: string; projectId: string | null; kw: number | null; customerFirst: string },
  said: readonly SaidSomewhere[],
  now = new Date(),
): { text: string; ask: DealAsk } | null {
  // Only a lead: a deal moved to Designed has a design somewhere, even when it isn't linked to a roof here.
  if (deal.stage !== "lead") return null;
  if (deal.projectId || deal.kw) return null;
  const why = wantsFrom(said);
  if (!why.length) return null;
  const name = deal.customerFirst || "the customer";
  const want = `A roof design for ${name}, built round what they've told us.`;
  const said1 = why[0];
  // Their own words when they wrote them; else what we noted from them, said as such.
  const lead = said1.where === WHERE.chat ? `${name} wrote` : "Our notes say";
  const text =
    `I need a design for ${name}. ${lead}: "${said1.text}" (${said1.where}, ${saidWhen(said1.at, now)}).` +
    (why.length > 1 ? ` There's more in the brief.` : "");
  return { text, ask: { type: "design", want, why } };
}

/** A request's brief as the designer shows it: what he wants, then each quote with where and when. */
export function briefLines(ask: DealAsk, now = new Date()): string[] {
  return [ask.want, ...ask.why.map((q) => `"${q.text}" (${q.where}, ${saidWhen(q.at, now)})`)];
}

/** A member's name as the deal chat shows it: their email's first part; Sol is Sol. */
export function writerName(by: string): string {
  if (by === SOL_WRITER) return "Sol";
  const h = handleOf(by)
    .replace(/[._-]+/g, " ")
    .trim();
  return h ? h.replace(/\b\w/g, (c) => c.toUpperCase()) : by;
}

/** The lines the feed card's pad shows: the latest few, oldest first, with any open request kept in view. */
export function padOf(lines: readonly DealLine[], n = PAD_LINES): DealLine[] {
  const latest = lines.slice(-n);
  const open = openAsks(lines).at(-1);
  if (!open || latest.includes(open)) return latest;
  return [open, ...(n > 1 ? lines.slice(-(n - 1)) : [])];
}

/** The @word being typed at the caret, for the people to offer; null when the caret isn't in one. */
export function typingMention(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)@([\w.-]{0,40})$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}
