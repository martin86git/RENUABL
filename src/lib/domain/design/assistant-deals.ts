/**
 * The deals the phone assistant is across (14 Nov 2026, Martin: "charlie should be able to show me the deals he's
 * across"; a pane beside its chat, so a deal can be picked and talked about with it directly). "Across" is its own
 * work only: the deals it has rung, has a call lined up for or is on a call with now. The rest of the pipeline is not
 * its business. Where each deal stands is read by rule from its calls, with no AI. Pure, tested.
 */
import { CALL_HEADLINES, type CallOutcome } from "../call-headlines";

export const ASSISTANT_DEAL_DAYS = 60;
export const ASSISTANT_DEALS_MAX = 60;
/** The calls on one deal given to the assistant when it is asked about that deal, and the lines of each. */
export const DEAL_CALLS_GIVEN = 4;
export const DEAL_CALL_LINES = 60;

export const DEAL_STANDINGS = ["needs-you", "live", "lined-up", "spoke", "no-answer"] as const;
export type DealStanding = (typeof DEAL_STANDINGS)[number];

export const STANDING_WORDS: Record<DealStanding, string> = {
  "needs-you": "Needs you",
  live: "On a call now",
  "lined-up": "Call lined up",
  spoke: "Spoke to them",
  "no-answer": "Couldn't reach them",
};

export interface AssistantDeal {
  jobId: string;
  customer: string;
  /** What the deal is ("Solar and battery"). */
  deal: string;
  /** The deal's stage in words. */
  stage: string;
  address: string;
  standing: DealStanding;
  /** What the latest call came to, in a few words, or that one is lined up. */
  headline: string;
  /** The assistant's summary of its latest call that ended, when there is one. */
  words: string;
  /** How many of its calls on the deal have ended. */
  calls: number;
  /** When the latest thing happened (ISO). */
  at: string;
  /** When the call lined up is due to ring (ISO), where that was kept: the start of its calling window. */
  dueAt?: string | null;
}

/** A call the assistant made on a deal, as the pane shows it under the deal picked. */
export interface AssistantDealCall {
  id: string;
  at: string;
  outcome: CallOutcome;
  headline: string;
  words: string;
  lines: { role: string; text: string }[];
}

/** Outcomes that leave the next move with a person in the business. */
const NEEDS_YOU: readonly CallOutcome[] = ["callback", "failed"];
const NOT_REACHED: readonly CallOutcome[] = ["no-answer", "voicemail"];

/** Where a deal stands with the assistant: a call on or lined up comes before what the last one came to. */
export function standingOf(o: { open: boolean; live: boolean; outcome: CallOutcome | null }): DealStanding {
  if (o.live) return "live";
  if (o.open) return "lined-up";
  if (o.outcome && NEEDS_YOU.includes(o.outcome)) return "needs-you";
  if (o.outcome && NOT_REACHED.includes(o.outcome)) return "no-answer";
  return "spoke";
}

export function headlineOf(standing: DealStanding, outcome: CallOutcome | null, attempts: number): string {
  if (standing === "live") return "On the call now";
  if (standing === "lined-up") return attempts > 0 ? "Will try again" : "Will call";
  return outcome ? CALL_HEADLINES[outcome] : "Called";
}

/**
 * The calls the assistant has on for today, in the order they ring (14 Nov 2026, Martin: opening the assistant should
 * land on "scheduled calls for today… in chronological order of time", not on the last conversation). A call on now
 * comes first, then those lined up for today by their time; one lined up with no time kept is taken as today's and
 * goes last. `dayOf` gives a time's day in the market (market.ts), so "today" is the business's, not the browser's.
 */
export function callsToday(deals: readonly AssistantDeal[], now: Date, dayOf: (at: Date) => string): AssistantDeal[] {
  const today = dayOf(now);
  const rank = (d: AssistantDeal) => (d.standing === "live" ? "0" : d.dueAt ? `1${d.dueAt}` : "2");
  return deals
    .filter((d) => d.standing === "live" || (d.standing === "lined-up" && (!d.dueAt || dayOf(new Date(d.dueAt)) <= today)))
    .sort((a, b) => rank(a).localeCompare(rank(b)) || a.customer.localeCompare(b.customer));
}

/** "2 calls today · 1 on now", over the welcome's list; null when there are none. */
export function callsTodayWords(calls: readonly AssistantDeal[]): string | null {
  if (!calls.length) return null;
  const live = calls.filter((c) => c.standing === "live").length;
  const count = `${calls.length} ${calls.length === 1 ? "call" : "calls"} today`;
  return live ? `${count} · ${live} on now` : count;
}

/** The deals in the pane's order: by standing (what needs a person first), the latest first within each. */
export function dealOrder(deals: readonly AssistantDeal[]): AssistantDeal[] {
  // Calls lined up run in the order they ring; everything else, the latest first.
  const soonest = (a: AssistantDeal, b: AssistantDeal) =>
    a.standing === "lined-up" && a.dueAt && b.dueAt ? a.dueAt.localeCompare(b.dueAt) : 0;
  return [...deals].sort(
    (a, b) => DEAL_STANDINGS.indexOf(a.standing) - DEAL_STANDINGS.indexOf(b.standing) || soonest(a, b) || b.at.localeCompare(a.at),
  );
}

/** The deals under each standing that has any, in order. */
export function dealGroups(deals: readonly AssistantDeal[]): { standing: DealStanding; deals: AssistantDeal[] }[] {
  const ordered = dealOrder(deals);
  return DEAL_STANDINGS.map((standing) => ({ standing, deals: ordered.filter((d) => d.standing === standing) })).filter(
    (g) => g.deals.length > 0,
  );
}

/** Every word typed must start a word of the customer, the deal or its address. */
export function searchDeals(deals: readonly AssistantDeal[], typed: string): AssistantDeal[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...deals];
  return deals.filter((d) => {
    const hay = `${d.customer} ${d.deal} ${d.address}`.toLowerCase().split(/[^a-z0-9]+/);
    return words.every((w) => hay.some((h) => h.startsWith(w)));
  });
}

/** "3 deals · 1 needs you", over the list. */
export function dealsSummary(deals: readonly AssistantDeal[]): string {
  if (!deals.length) return "No deals yet";
  const needs = deals.filter((d) => d.standing === "needs-you").length;
  const count = `${deals.length} ${deals.length === 1 ? "deal" : "deals"}`;
  return needs ? `${count} · ${needs} ${needs === 1 ? "needs" : "need"} you` : count;
}

const flat = (s: string, max: number) =>
  s
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** What the assistant is given about the deal picked beside its chat: the deal in a few lines and its own calls on it. */
export interface DealForChat {
  /** "Michelle's deal", shown over the member's message. */
  about: string;
  customer: string;
  deal: string;
  stage: string;
  suburb: string;
  standing: DealStanding;
  calls: readonly Pick<AssistantDealCall, "at" | "headline" | "words" | "lines">[];
}

/**
 * The deal as it is put to the assistant: data in a tag, never instructions. Only what the pane already shows the
 * member: no phone, no email, no price, no cost.
 */
export function dealBlock(d: DealForChat, assistant: string, day: (iso: string) => string): string {
  const calls = d.calls.slice(0, DEAL_CALLS_GIVEN).map((c) => {
    const said = c.lines
      .slice(0, DEAL_CALL_LINES)
      .map((l) => `${l.role === "customer" ? "Customer" : assistant}: ${flat(l.text, 400)}`)
      .join("\n");
    return `Call on ${day(c.at)}: ${flat(c.headline, 120)}${c.words ? `\nSummary: ${flat(c.words, 900)}` : ""}${said ? `\n${said}` : "\n(no transcript kept)"}`;
  });
  return `<the_deal about="${flat(d.about, 80).replace(/"/g, "'")}">
Customer: ${flat(d.customer, 80)}
Deal: ${flat(d.deal, 120)} · ${flat(d.stage, 40)}${d.suburb ? ` · ${flat(d.suburb, 60)}` : ""}
Where it stands with you: ${STANDING_WORDS[d.standing]}
${calls.length ? calls.join("\n\n") : "You haven't spoken to them yet."}
</the_deal>`;
}

/** What the assistant is told about answering on a deal, beside its coaching rules. */
export const DEAL_CHAT_RULES = `- They have one deal open beside this chat (in the_deal below). When they ask about that customer or what was said, answer from the_deal only, in a sentence or two, and change no notes. Never make up what a customer said; when it isn't there, say you don't have it.
- You know only your own calls on it. For its price, design, proposal or anything else, say the deal page or Sol has it.
- Your notes are for every call. When they ask for something for this one customer only, don't add a note: tell them to use "Call back to ask" on the deal, which has you ring and ask exactly that.
- You can't ring, text or change anything from this chat: point them to the buttons on the deal beside you.`;
