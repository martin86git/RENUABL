/**
 * What Sol's chat offers before anything is asked (24 Nov 2026, Martin, from HubSpot's Breeze: "a much better way of
 * showing suggestions"; pressing Summarize opened its own prompts, "great to incorporate into our sol chat
 * everywhere"). A greeting, a Suggested card of a few things to ask, then four topics as tiles, each opening its own
 * prompts in the Suggested card's place. Every prompt is a question Sol can answer from what he has (the deals, the
 * calendar, his drafting, the web): nothing promises what he can't do. Pure, tested.
 */
import { STARTER_QUESTIONS } from "./sol-knowledge";

export type SolTopic = "summarise" | "write" | "find" | "solar";

export const SOL_TOPICS: readonly { id: SolTopic; label: string; prompts: readonly string[] }[] = [
  {
    id: "summarise",
    label: "Summarise",
    prompts: ["Summarise my open deals", "Summarise this week's activity", "Summarise my newest leads"],
  },
  {
    id: "write",
    label: "Write",
    prompts: [
      "Draft a follow-up email to my newest lead",
      "Write a reply to the latest customer message",
      "Draft a check-in for proposals gone quiet",
    ],
  },
  {
    id: "find",
    label: "Find",
    prompts: [
      "When did we last close a deal?",
      "Which deals have sat at Proposal sent the longest?",
      "Which new leads has nobody contacted yet?",
    ],
  },
  {
    id: "solar",
    label: "Ask solar",
    prompts: STARTER_QUESTIONS.slice(0, 3),
  },
];

/** The Suggested card: one from each of the business's own topics, then one of the oracle's. */
export const SOL_SUGGESTED: readonly string[] = [
  "What can Sol help me with?",
  "Summarise my open deals",
  "Draft a follow-up email to my newest lead",
  "Which deals have sat at Proposal sent the longest?",
  STARTER_QUESTIONS[0],
];

export const topicOf = (id: string | null | undefined) => SOL_TOPICS.find((t) => t.id === id) ?? null;

/** The greeting: by first name once given, never a name guessed from an email. */
export function solGreeting(firstName?: string | null): string {
  const name = (firstName ?? "").trim().split(/\s+/)[0];
  return name ? `Ready when you are, ${name}` : "Ready when you are";
}
