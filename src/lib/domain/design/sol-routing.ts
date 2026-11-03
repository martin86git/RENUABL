/**
 * Which model answers for Sol, and what an answer costs in credits (Martin, 3 Nov 2026: "heavily skewed to Sonnet",
 * with Opus "whenever it's something that requires creativity or a better answer"). Pure, tested (`sol-routing.test.ts`).
 *
 * Two kinds of answer. A **quick** answer (Sonnet) is everyday work: finding a deal, what's at a stage, a summary,
 * a reminder, a chart, a figure from the record. A **deep** answer (Opus) is where being better matters: anything a
 * customer will read, judgement and advice, attachments to reason over, a call written up, and whenever the member
 * asks for it. A quick answer can also hand itself up (`think_deeper`) when it finds the question needs more care,
 * so a question the rules read as quick never gets a weaker answer than it should.
 */
import type { SolUse } from "./sol-credits";

export type SolTier = "quick" | "deep";

/** The models, by tier. `SOL_QUICK_MODEL` and `SOL_MODEL` (the deep one, as it always was) change them. */
export const SOL_MODELS: Record<SolTier, string> = { quick: "claude-sonnet-5-5", deep: "claude-opus-5-5" };

export function solModel(tier: SolTier, env: Record<string, string | undefined> = {}): string {
  const set = tier === "deep" ? env.SOL_MODEL : env.SOL_QUICK_MODEL;
  return set?.trim() || SOL_MODELS[tier];
}

/**
 * Credits an answer takes. Set from what each costs RENUABL (about US$0.04 a quick answer, three times that for a
 * deep one, at list prices; `ai-costs.ts`), so a credit is worth about the same whichever answers.
 */
export const TIER_CREDITS: Record<SolTier, number> = { quick: 1, deep: 3 };
/**
 * Added when he searched or read the web for the answer: search results are long (tens of thousands of tokens) and
 * each search is charged, so a researched answer costs several plain ones.
 */
export const RESEARCH_CREDITS = 2;

export function creditsFor(tier: SolTier, researched: boolean): number {
  return TIER_CREDITS[tier] + (researched ? RESEARCH_CREDITS : 0);
}

/** The work that isn't a question in the chat, and how much care each needs. */
export const USE_TIER: Record<Exclude<SolUse, "chat" | "channel">, SolTier> = {
  // A customer reads it.
  customer: "deep",
  // A whole call, turned into notes, a recap and changes to the deal.
  "call-notes": "deep",
  // Summarising is quick; a reply drafted is decided per request (`inboxTier`).
  inbox: "quick",
  // Finding one figure in the customer's file.
  usage: "quick",
};

/** An email summarised is quick; a reply drafted for a customer is deep. */
export const inboxTier = (drafting: boolean): SolTier => (drafting ? "deep" : "quick");

/** Asked for in so many words. */
const ASKED_DEEP = /\b(think (harder|deeper|(it )?through|carefully)|in (depth|detail)|deep dive|thorough(ly)?|take your time)\b/i;
/** Writing someone else will read. */
const WRITING =
  /\b(write|draft|re-?word|rewrite|compose|reply|respond|script|pitch|wording|word it|polish|letter|follow[- ]?up (email|message|text))\b/i;
/** Judgement, advice and weighing things up. */
const JUDGEMENT =
  /\b(why|should (i|we)|recommend|advi[cs]e|strateg|plan (for|to|out)|compare|comparison|versus|vs\.?|pros and cons|trade-?offs?|best (way|option|approach)|objection|negotiat|convince|forecast|analy[sz]e|analysis|what would you|how (do|can|should|would) (i|we) (handle|win|close|deal with|approach|price))\b/i;
/** A question this long carries enough to be worth the care. */
const LONG_QUESTION = 700;

export interface RouteInput {
  text: string;
  /** Files sent with it. */
  files: number;
  /** The member pressed Think deeper. */
  asked?: boolean;
}

export interface Route {
  tier: SolTier;
  /** Why, in a few words, kept with the answer's cost. */
  reason: string;
}

/** Quick unless the question needs more: Sonnet is the everyday Sol, and most questions are everyday ones. */
export function routeQuestion({ text, files, asked }: RouteInput): Route {
  if (asked) return { tier: "deep", reason: "asked to think deeper" };
  if (files > 0) return { tier: "deep", reason: "files to read" };
  if (ASKED_DEEP.test(text)) return { tier: "deep", reason: "asked to think deeper" };
  if (WRITING.test(text)) return { tier: "deep", reason: "writing" };
  if (JUDGEMENT.test(text)) return { tier: "deep", reason: "judgement" };
  if (text.length > LONG_QUESTION) return { tier: "deep", reason: "long question" };
  return { tier: "quick", reason: "everyday" };
}

/** The tool a quick answer has for handing itself up. */
export const THINK_DEEPER_TOOL = {
  name: "think_deeper",
  description:
    "Hand this question to your deeper thinking before you answer it. Use it when a quick answer wouldn't do the question justice: words a customer will read, advice or judgement with trade-offs, a technical or regulatory question where being wrong matters, several deals weighed together, or anything you'd otherwise answer with a guess. Call it first, on its own, before any other tool or any answer. Don't use it for lookups, lists, summaries, reminders or charts.",
  input_schema: { type: "object" as const, properties: { why: { type: "string" } }, required: ["why"] },
};

/** Said under an answer: what it took. */
export function costWords(tier: SolTier, credits: number): string {
  const n = `${credits} credit${credits === 1 ? "" : "s"}`;
  return tier === "deep" ? `Deep answer · ${n}` : n;
}
