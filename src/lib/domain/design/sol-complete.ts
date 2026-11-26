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

/** The most of a person's own questions kept as suggestions. */
export const LEARNED_MAX = 60;

/**
 * A person's own questions to Sol, as suggestions (26 Nov 2026, Martin: "Can suggestions be building dynamically upon
 * what users are asking"): what they asked in every conversation, kept and filed away, the most asked first, then the
 * latest. Only plain questions of a sentence or two: never a reply quoting Sol, a deal's prefix, a row taken up, or
 * anything long. Their own only: one person's questions never reach another's box.
 */
export function learnedPhrases(asked: readonly { text: string; at: string }[]): string[] {
  const tally = new Map<string, { phrase: string; count: number; last: string }>();
  for (const { text, at } of asked) {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length < 8 || t.length > 140) continue;
    if (/^(replying to|on .{1,60}'s deal|let's work on this one|think deeper|@sol)/i.test(t)) continue;
    const k = plain(t).replace(/[.?!]+$/, "");
    const seen = tally.get(k);
    if (seen) {
      seen.count += 1;
      if (at > seen.last) {
        seen.last = at;
        seen.phrase = t;
      }
    } else tally.set(k, { phrase: t, count: 1, last: at });
  }
  return [...tally.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .slice(0, LEARNED_MAX)
    .map((x) => x.phrase);
}

/** Their own questions first, then the team's, then the usual ones. */
export const phrasesWith = (learned: readonly string[], team: readonly string[] = []): string[] => [...learned, ...team, ...SOL_PHRASES];

/** The most of the team's questions shared. */
export const TEAM_MAX = 40;

/** Words that may start with a capital mid-question without naming anyone: the product, makers, months and days. */
const SAFE_CAPITALS = new Set(
  (
    "I Sol RENUABL STC STCs BSTC BSTCs VIC NSW QLD SA WA TAS ACT NT AS NZS CEC CER EV EVs PV kW kWh MPPT RCBO MSB NMI CoES " +
    "AEMO DNSP Solar Victoria Google Meet Gmail Outlook Xero Pylon HubSpot Nearmap Today Feed Proposal Proposals Deals " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September " +
    "October November December Jinko Trina LONGi Longi Tindo REC SunPower Canadian Risen Aiko Sungrow Fronius SolarEdge " +
    "Enphase Huawei GoodWe Growatt SMA Sigenergy Tesla Powerwall BYD Alpha ESS AlphaESS Redback Zappi Wallbox Ocpp OCPP"
  ).split(" "),
);

/**
 * A question safe to offer the rest of the team: no customer's name in it, no email, phone number, address number or
 * link, and no word with a capital mid-question that isn't a known maker, month, day or solar term (a name of a
 * person or street we don't know of). Better to drop a good question than show someone's customer to a colleague.
 */
export function shareable(text: string, customerWords: ReadonlySet<string>): boolean {
  if (/@|https?:|www\.|\d{4,}|\d+\s+[a-z]+\s+(st|street|rd|road|ave|avenue|ct|court|dr|drive|cres|pl|place|way|lane|ln)\b/i.test(text))
    return false;
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  for (const [i, w] of words.entries()) {
    const bare = w.replace(/['’]s$/i, "");
    if (customerWords.has(bare.toLowerCase())) return false;
    if (i > 0 && /^[A-Z]/.test(bare) && !SAFE_CAPITALS.has(bare)) return false;
  }
  return true;
}

/** Each customer's first and last names as lower-case words of three letters or more, for `shareable`. */
export function customerWordsOf(names: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const n of names) for (const w of n.toLowerCase().match(/[a-z][a-z'’-]{2,}/g) ?? []) out.add(w.replace(/['’]s$/, ""));
  return out;
}

/**
 * The team's questions (26 Nov 2026, Martin: next to "building dynamically upon what users are asking", across the
 * business): what the others in the business asked Sol, only those `shareable`, the questions most people asked first,
 * then the most asked, then the latest. The asker is never shown.
 */
export function teamPhrases(asked: readonly { who: string; text: string; at: string }[], customerWords: ReadonlySet<string>): string[] {
  const tally = new Map<string, { phrase: string; who: Set<string>; count: number; last: string }>();
  for (const { who, text, at } of asked) {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length < 8 || t.length > 140 || !shareable(t, customerWords)) continue;
    if (/^(replying to|on .{1,60}'s deal|let's work on this one|think deeper|@sol)/i.test(t)) continue;
    const k = plain(t).replace(/[.?!]+$/, "");
    const seen = tally.get(k) ?? { phrase: t, who: new Set<string>(), count: 0, last: "" };
    seen.who.add(who);
    seen.count += 1;
    if (at > seen.last) seen.last = at;
    tally.set(k, seen);
  }
  return [...tally.values()]
    .sort((a, b) => b.who.size - a.who.size || b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .slice(0, TEAM_MAX)
    .map((x) => x.phrase);
}
