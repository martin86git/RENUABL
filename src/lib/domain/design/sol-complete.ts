/**
 * Predictive text in Sol's box (26 Nov 2026, Martin: "introduce predictive auto text to help complete a sentence").
 * By rule, in the page, no Sol credit: what has been typed is matched against the things people ask Sol, and the rest
 * of the first that starts the same way is offered. Only ever a suggestion: nothing is added until it is taken.
 * Pure, tested.
 */
import { SOL_SUGGESTED, SOL_TOPICS } from "./sol-suggest";

/** The sentences people ask Sol most, first first. */
export const SOL_PHRASES: readonly string[] = [
  "Who should I call first today?",
  "Which proposals have gone quiet?",
  "Which deals need me today?",
  "Which new leads has nobody contacted yet?",
  "Which deals have sat at Proposal sent the longest?",
  "What's on my calendar today?",
  "What's on my calendar this week?",
  "What installs are booked this week?",
  "What installs are booked next week?",
  "What isn't ordered for next week's installs?",
  "Why are we down on last month?",
  "Why are we up on last month?",
  "How are sales tracking this month?",
  "How many deals did we sign this month?",
  "How many contacts do I have?",
  "How many proposals are waiting to be signed?",
  "When did we last close a deal?",
  "When is the next install?",
  "Where is the customer's deal up to?",
  "Show me my day",
  "Show me the rooftop design of the next install",
  "Show me the pipeline",
  "Summarise my open deals",
  "Summarise this week's activity",
  "Summarise my newest leads",
  "Summarise the last call with",
  "Draft a follow-up email to my newest lead",
  "Draft a follow-up email to",
  "Draft a reply to the latest customer message",
  "Draft a check-in for proposals gone quiet",
  "Draft a text to",
  "Write a reply to the latest customer message",
  "Write an email to",
  "Remind me tomorrow at 9am to",
  "Remind me to call",
  "Remind me to follow up",
  "Book a meeting with",
  "Book a Google Meet with",
  "Call the customer back about",
  "Find the deal for",
  "Find the datasheet for",
  "Open the designer for",
  "Open the proposal for",
  "What size battery suits a home using",
  "What size system suits a home using",
  "What's the clearance from a gas meter to a battery?",
  "What are the export limits on single phase?",
  "What rebates apply to a battery in Victoria?",
  "What is the STC price today?",
  "Is a network pre-approval needed for",
  "Compare Sigenergy and Tesla batteries",
  "Compare the inverters on my price list",
  ...SOL_SUGGESTED,
  ...SOL_TOPICS.flatMap((t) => t.prompts),
];

/** The least typed before anything is offered. */
export const COMPLETE_FROM = 3;

const plain = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[’]/g, "'");

/**
 * The rest of a sentence that starts as the words typed so far, or "". It completes the box's last sentence (after
 * a full stop, question mark or new line), so it keeps helping as more is written. Never offered when the words
 * already end the sentence, or when what is typed is already a whole phrase.
 */
export function completionFor(text: string, phrases: readonly string[] = SOL_PHRASES): string {
  if (!text || /\s{2,}$/.test(text)) return "";
  const last = text.split(/(?<=[.?!])\s+|\n/).pop() ?? "";
  const typed = last.replace(/^\s+/, "");
  if (typed.length < COMPLETE_FROM || /[.?!]$/.test(typed)) return "";
  const want = plain(typed);
  const seen = new Set<string>();
  for (const phrase of phrases) {
    const p = plain(phrase);
    if (seen.has(p)) continue;
    seen.add(p);
    if (p.length > want.length && p.startsWith(want)) return phrase.slice(typed.length);
  }
  return "";
}
