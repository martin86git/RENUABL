/**
 * The customer's proposal, read as they scroll (26 Nov 2026, Martin, from his iPhone: keep the option they are on in a
 * compact bar at the top as they scroll; a "like" on each option; and "an element of live ai in the proposal possibly
 * asking questions after certain information is revealed on screen").
 *
 * Two rules here, both pure:
 * - Likes: which options a customer likes, cleaned from what a browser sends, and the line written on the deal.
 * - Questions as a part of the page comes into view: one short question and two or three answers to tap, by rule (no
 *   AI writes them, so none can say something it shouldn't). A tap is sent into the customer's chat with the business,
 *   where Sol answers when the business has him answering customers, else the team does. Never a figure, price,
 *   promise or saving: the questions only invite theirs.
 */
import type { BlockId } from "./blocks";

/** A part of the page that asks something once it has been read. */
export type RevealKey = Extract<BlockId, "options" | "hero" | "figures" | "production" | "bill" | "price" | "payment" | "warranty">;

export interface RevealQuestion {
  key: RevealKey;
  /** What the assistant asks. */
  ask: string;
  /** What the customer can tap, each sent as their own message. */
  replies: readonly string[];
}

/** In the order a proposal usually reads. Words only invite their questions; nothing here states a fact. */
export const REVEAL_QUESTIONS: readonly RevealQuestion[] = [
  {
    key: "options",
    ask: "Which matters most to you in a system?",
    replies: ["The lowest price", "The biggest saving", "Power in a blackout"],
  },
  {
    key: "hero",
    ask: "Want to know how the battery would run your evenings?",
    replies: ["How does the battery work?", "How long would it last at night?"],
  },
  {
    key: "figures",
    ask: "Anything here you'd like explained?",
    replies: ["What's included?", "How was it sized?"],
  },
  {
    key: "production",
    ask: "Questions about what the panels would make?",
    replies: ["What about cloudy days?", "Does shade affect it?"],
  },
  {
    key: "bill",
    ask: "Want to know how the savings were worked out?",
    replies: ["How were the savings worked out?", "Do rebates change it?"],
  },
  {
    key: "price",
    ask: "Any questions about the price?",
    replies: ["What's included in the price?", "Could there be extra costs?", "Can I pay it off over time?"],
  },
  {
    key: "payment",
    ask: "Questions about paying?",
    replies: ["When is the deposit due?", "Can I pay by card?"],
  },
  {
    key: "warranty",
    ask: "Anything you'd like to know about the warranty?",
    replies: ["What does the warranty cover?", "Who do I call if something goes wrong?"],
  },
];

/** At most this many questions a visit, so the page never nags. */
export const REVEAL_MOST = 3;
/** How long a part must be in view before it asks, so a quick scroll past asks nothing. */
export const REVEAL_DWELL_MS = 2500;

/** The question for a part of the page, unless it has asked already or the visit has had its share. */
export function revealFor(key: string, asked: readonly string[]): RevealQuestion | null {
  if (asked.length >= REVEAL_MOST || asked.includes(key)) return null;
  return REVEAL_QUESTIONS.find((q) => q.key === key) ?? null;
}

/** Options are keyed by short codes ("design-1", "best-return", "cfg-…"); only those are kept, at most ten. */
const LIKE_KEY = /^[a-z0-9-]{1,40}$/;
export const MAX_LIKES = 10;

/** The options a customer likes, as a browser sent them: real keys only, each once. */
export function cleanLikes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const x of input) if (typeof x === "string" && LIKE_KEY.test(x) && !out.includes(x)) out.push(x);
  return out.slice(0, MAX_LIKES);
}

/** One option liked or unliked, from what a browser sent. */
export function cleanLike(body: { option?: unknown; liked?: unknown }): { option: string; liked: boolean } | null {
  if (typeof body.option !== "string" || !LIKE_KEY.test(body.option)) return null;
  return { option: body.option, liked: body.liked !== false };
}

/** The line written on the deal when a customer likes an option (never when they take a like back). */
export const likeRecordLine = (optionName: string) => `The customer liked ${optionName} on their proposal.`;
