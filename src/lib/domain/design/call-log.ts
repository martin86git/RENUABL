/**
 * The call log on Today (8 Nov 2026, Martin: a Calls tab between Deals and Inbox for the phone assistant, Vapi, with a
 * log of its calls). Every call on the deals this member may see, newest first: the ones the business's phone
 * assistant (Sol until the business names it) made through Vapi, each with what it came to, his summary and the transcript, and the calls the team logged on
 * a deal (the note-taker or a note of kind call). Above them, the calls Sol still has lined up. Pure, tested.
 */
import { recordingOf } from "../browser-call";
import { OUTCOME_WORDS, type CallOutcome } from "../voice-agent";

/** How far back the log reaches. */
export const CALL_LOG_DAYS = 60;
/** The most calls the log holds. */
export const CALL_LOG_MAX = 150;

export interface CallLogEntry {
  id: string;
  jobId: string;
  customer: string;
  deal: string;
  /** ISO time the call ended (Sol's) or was logged (the team's). */
  at: string;
  /** Sol's call through Vapi, or one the team logged. */
  who: "sol" | "team";
  /** The phone assistant's name (Sol, or the name the business gave it), or the member's email. */
  by: string;
  /** What Sol's call came to; null for the team's. */
  outcome: CallOutcome | null;
  /** Sol's summary, or the words the team logged. */
  words: string;
  transcript: string | null;
}

/** A call Sol still has lined up: waiting for calling hours or a retry, or ringing now. */
export interface CallComing {
  id: string;
  jobId: string;
  customer: string;
  deal: string;
  /** "lead" a new lead; "proposal" a customer who asked for a call on their proposal. */
  mode: "lead" | "proposal";
  status: "waiting" | "calling";
  attempts: number;
  at: string;
}

export type CallFilter = "all" | "sol" | "team";
export const CALL_FILTERS: { id: CallFilter; label: string }[] = [
  { id: "all", label: "All calls" },
  { id: "sol", label: "Sol's calls" },
  { id: "team", label: "Team's calls" },
];

export function callsOf(entries: readonly CallLogEntry[], filter: CallFilter): CallLogEntry[] {
  return entries.filter((e) => filter === "all" || e.who === filter).sort((a, b) => b.at.localeCompare(a.at));
}

/** The caller's name: the assistant's, or the part of a member's email before the @. */
export function callerName(e: Pick<CallLogEntry, "who" | "by">): string {
  if (e.who === "sol") return e.by.trim() || "Sol";
  return e.by.split("@")[0] || "Someone";
}

/** What the call came to, in a few words. */
export function outcomeWords(e: Pick<CallLogEntry, "outcome">): string {
  return e.outcome ? OUTCOME_WORDS[e.outcome] : "Call logged";
}

/** Whether the outcome went well (green), wants the team (amber), or neither. */
export function outcomeTone(outcome: CallOutcome | null): "good" | "needs" | "plain" {
  if (outcome === "booked" || outcome === "link-sent" || outcome === "transferred") return "good";
  if (outcome === "callback" || outcome === "no-more-calls" || outcome === "failed") return "needs";
  return "plain";
}

/**
 * The words a team-logged call carries, without the record's own lead-in. A call logged from the note-taker can be long:
 * the log keeps the first `max` characters.
 */
export function loggedWords(text: string, max = 400): string {
  const t = (recordingOf(text)?.text ?? text).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "Waiting for calling hours", "Ringing now", "Trying again (2 tries so far)". */
export function comingWords(c: Pick<CallComing, "status" | "attempts" | "mode">): string {
  if (c.status === "calling") return "Ringing now";
  const why = c.mode === "proposal" ? "They asked for a call" : "New lead";
  return c.attempts > 0
    ? `${why} · trying again (${c.attempts} ${c.attempts === 1 ? "try" : "tries"} so far)`
    : `${why} · next calling window`;
}

/** The day a call falls on in the market, for grouping: "Today", "Yesterday", or "Thu 5 Nov". */
export function callDay(at: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const that = day(new Date(at));
  if (that === day(now)) return "Today";
  if (that === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Date(at).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
}
