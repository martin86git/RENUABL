/**
 * Sol's sales agents (5 Nov 2026, Martin: phase two; Sol reaching out to customers to close them, with the team able
 * to see he is at work and doing the right work). One Sol wearing a hat for each stage of the pipeline, never four
 * characters: "Sol · Proposals" and so on, each with its own job, all drawing from one outbox. Each agent is on or off
 * (off to start: its drafts wait for a press). On, it sends in business hours (or the longer hours chosen), never
 * sooner than `MIN_REVIEW_MINUTES` after an email was ready, so there is time to read it, change it, hold it or skip
 * it, and never once the customer has written or the deal has moved on.
 * Pure: no I/O.
 */
import { LAUNCH_MARKET, marketDateTime, todayInMarket } from "../market";
import type { JobStage } from "./crm";
import { MAX_ATTEMPTS } from "../voice-agent";
import { HELLO_REVIEW_MINUTES } from "./first-contact";
import { FOLLOW_UP_DAYS } from "./proposal-lists";
import { isWorkingDay, nextWorkingDay } from "./today-pad";

export const AGENT_STAGES = ["lead", "designed", "proposal", "won"] as const;
export type AgentStage = (typeof AGENT_STAGES)[number];

export interface Agent {
  stage: AgentStage;
  name: string;
  /** What this is, in one sentence. */
  what: string;
  /** What it does, in one sentence. */
  job: string;
  /** Whether it lines anything up yet; the others say what they will do. */
  working: boolean;
  /** For one not working yet: what is coming. */
  soon?: string;
}

export const AGENTS: Record<AgentStage, Agent> = {
  lead: {
    stage: "lead",
    name: "Sol · Leads",
    what: "Sol, looking after new leads before there's a design.",
    job: "Emails each new lead a short hello within minutes, with a link to their own page: their home from above, and a chat Sol answers.",
    working: true,
  },
  designed: {
    stage: "designed",
    name: "Sol · Designs",
    what: "Sol, looking after deals with a design before the proposal goes.",
    job: "Gets the design checked and the indicative proposal out.",
    working: false,
    soon: "Coming next: telling you when a design is ready to send, and sending it with your note.",
  },
  proposal: {
    stage: "proposal",
    name: "Sol · Proposals",
    what: "Sol, looking after customers who have your proposal.",
    job: "Emails a friendly follow-up when a proposal goes quiet (2, 7 and 14 days after it's sent), to guide the customer to sign.",
    working: true,
  },
  won: {
    stage: "won",
    name: "Sol · Won",
    what: "Sol, looking after sold deals until the install.",
    job: "Chases the deposit and approvals, and gets the install ready.",
    working: false,
    soon: "Coming next: deposit reminders and the welcome to the install.",
  },
};

/**
 * Which agent an email in the outbox is for: a new lead's hello is Sol · Leads' at lead or designed (an automatic
 * design moves a lead on, and that's no reason to stop the hello); anything else follows the deal's stage.
 */
export function agentOfItem(kind: string, stage: JobStage | undefined): AgentStage | null {
  if (!stage) return null;
  if (kind === "hello") return stage === "lead" || stage === "designed" ? "lead" : null;
  return agentFor(stage);
}

/** The board's column a deal's stage answers to, or null for one no agent works on. */
export function agentFor(stage: JobStage): AgentStage | null {
  return (AGENT_STAGES as readonly string[]).includes(stage) ? (stage as AgentStage) : null;
}

/**
 * When Sol may send (5 Nov 2026, Martin: send windows at set times didn't make sense to anyone; business hours do).
 * Working days only (no weekends or Victorian public holidays), in the market's time.
 */
export const SEND_HOURS = {
  business: { label: "Business hours", words: "weekdays, 9 am to 5 pm", from: 9 * 60, to: 17 * 60 },
  long: { label: "Longer hours", words: "weekdays, 8 am to 7 pm", from: 8 * 60, to: 19 * 60 },
} as const;
export type SendHours = keyof typeof SEND_HOURS;

/** Each email waits this long once written, so it can be read, changed or stopped (its countdown shows on the card). */
export const MIN_REVIEW_MINUTES = 30;

export interface AgentSettings {
  /** The agents sending their emails themselves. An agent that is off drafts, and a person presses send. */
  on: AgentStage[];
  /** When they may send. */
  hours: SendHours;
  /**
   * The rest of the routines (20 Nov 2026, Martin: the Routines page, "adjusting here should adjust actions"):
   * the days after a proposal goes out that a follow-up falls due, ascending, one to three of them.
   */
  followUpDays: number[];
  /** How long an email Sol wrote waits to be read before it goes. */
  reviewMinutes: number;
  /** How long a new lead's hello waits (speed to lead: minutes, not half an hour). */
  helloMinutes: number;
  /** How many times a voice agent rings a new lead before it hands them to the team. */
  callAttempts: number;
}

/** What can be chosen for each, so nothing odd is ever kept. */
export const ROUTINE_CHOICES = {
  reviewMinutes: [10, 30, 60, 120],
  helloMinutes: [2, 5, 15, 30],
  callAttempts: [1, 2, 3],
  followUpDay: { min: 1, max: 30, most: 3 },
} as const;

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  on: [],
  hours: "business",
  followUpDays: [...FOLLOW_UP_DAYS],
  reviewMinutes: MIN_REVIEW_MINUTES,
  helloMinutes: HELLO_REVIEW_MINUTES,
  callAttempts: MAX_ATTEMPTS,
};

/** Follow-up days made whole: whole days in range, no repeats, ascending, at most three; none sent keeps ours. */
export function cleanFollowUpDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...FOLLOW_UP_DAYS];
  const { min, max, most } = ROUTINE_CHOICES.followUpDay;
  const days = [...new Set(raw.filter((d): d is number => Number.isInteger(d) && d >= min && d <= max))].sort((a, b) => a - b);
  return days.length ? days.slice(0, most) : [...FOLLOW_UP_DAYS];
}

const oneOf = <T extends number>(raw: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback;

/** Settings from anywhere made whole and safe. Older settings (one switch for all, with pauses) read as the same agents on. */
export function cleanAgentSettings(raw: unknown): AgentSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const on = Array.isArray(r.on)
    ? AGENT_STAGES.filter((s) => (r.on as unknown[]).includes(s))
    : r.sending === true && r.pausedAll !== true
      ? AGENT_STAGES.filter((s) => !(Array.isArray(r.paused) && r.paused.includes(s)))
      : [];
  return {
    on,
    hours: r.hours === "long" ? "long" : "business",
    followUpDays: cleanFollowUpDays(r.followUpDays),
    reviewMinutes: oneOf(r.reviewMinutes, ROUTINE_CHOICES.reviewMinutes, MIN_REVIEW_MINUTES),
    helloMinutes: oneOf(r.helloMinutes, ROUTINE_CHOICES.helloMinutes, HELLO_REVIEW_MINUTES),
    callAttempts: oneOf(r.callAttempts, ROUTINE_CHOICES.callAttempts, MAX_ATTEMPTS),
  };
}

/** Whether this agent sends its emails itself. */
export const agentOn = (settings: Pick<AgentSettings, "on">, stage: AgentStage | null): boolean =>
  Boolean(stage && settings.on.includes(stage));

const minuteOfDay = (at: Date) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
};

/** Whether a moment is inside the hours, on a working day. */
export function withinHours(at: Date, hours: SendHours): boolean {
  const h = SEND_HOURS[hours];
  const m = minuteOfDay(at);
  return isWorkingDay(todayInMarket(at)) && m >= h.from && m < h.to;
}

/** The first moment at or after `from` inside the hours. */
export function nextOpen(from: Date, hours: SendHours): string {
  const h = SEND_HOURS[hours];
  if (withinHours(from, hours)) return from.toISOString();
  let day = todayInMarket(from);
  for (let i = 0; i < 30; i++) {
    if (isWorkingDay(day)) {
      const open = marketDateTime(day, Math.floor(h.from / 60), h.from % 60);
      if (Date.parse(open) >= from.getTime()) return open;
    }
    day = nextWorkingDay(day);
  }
  return from.toISOString();
}

/**
 * When an email that was ready at `readyAt` goes, as of now: half an hour after it was ready, or when the hours next
 * open after that. One whose time passed out of hours (nobody had RENUABL open and the cron hadn't run) waits for
 * the hours to open again, so nothing reaches a customer at night.
 */
export function sendAt(readyAt: string, hours: SendHours, now = new Date(), wait = MIN_REVIEW_MINUTES): string {
  const ready = Date.parse(readyAt);
  const earliest = new Date((Number.isNaN(ready) ? now.getTime() : ready) + wait * 60_000);
  const at = nextOpen(earliest, hours);
  return now.getTime() > Date.parse(at) && !withinHours(now, hours) ? nextOpen(now, hours) : at;
}

/** "Later" on an email Sol has lined up: in an hour, or 9 am on the next working day. */
export type Later = "hour" | "tomorrow";

/** When an email put off by "Later" may go, as an ISO time (still only inside the business's hours). */
export function laterAt(later: Later, now = new Date()): string {
  if (later === "hour") return new Date(now.getTime() + 60 * 60_000).toISOString();
  return marketDateTime(nextWorkingDay(todayInMarket(now)), 9);
}

/**
 * When an outbox email goes: the usual time after it was ready, or, when someone put it off, the first open time
 * from then (8 Nov 2026, Martin: the countdown is the person's to change).
 */
export function firesAtFor(
  item: { createdAt: string; notBefore?: string; kind?: string },
  settings: SendHours | Pick<AgentSettings, "hours" | "reviewMinutes" | "helloMinutes">,
  now = new Date(),
): string {
  const s =
    typeof settings === "string" ? { hours: settings, reviewMinutes: MIN_REVIEW_MINUTES, helloMinutes: HELLO_REVIEW_MINUTES } : settings;
  if (item.notBefore && !Number.isNaN(Date.parse(item.notBefore))) return nextOpen(new Date(item.notBefore), s.hours);
  // A new lead's hello waits only minutes: speed to lead (first-contact.ts).
  return sendAt(item.createdAt, s.hours, now, item.kind === "hello" ? s.helloMinutes : s.reviewMinutes);
}

/** A clock time in the market as people say it: "10 am", "2:30 pm". */
function clock(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const half = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase().replace(/\./g, "");
  return `${hour}${minute === "00" ? "" : `:${minute}`} ${half}`.trim();
}

/** How long until it goes, for the card: "in 1h 52m", "in 12m", "now", then "at 10 am tomorrow" or "at 2 pm Mon". */
export function countdownWords(firesAtIso: string, now = new Date()): string {
  const at = new Date(firesAtIso);
  const minutes = Math.ceil((at.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 6 * 60) return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const today = todayInMarket(now);
  const day = todayInMarket(at);
  if (day === today) return `at ${clock(at)}`;
  if (day === nextWorkingDayOrTomorrow(today)) return `at ${clock(at)} tomorrow`;
  const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, weekday: "short" }).format(at);
  return `at ${clock(at)} ${weekday}`;
}

/** The calendar day after this one (tomorrow, working or not). */
function nextWorkingDayOrTomorrow(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Where an email in the outbox stands, for the card's chip and the agent's list. */
export type OutboxState = "counting" | "waiting" | "held" | "no-email";

/**
 * Where it stands: counting down while its agent is on, or when a person picked when it goes (In an hour, Tomorrow at
 * 9: choosing the time is saying send it then); waiting for a press otherwise; held when someone held it; no-email
 * when the customer has no address.
 */
export function outboxState(input: {
  stage: AgentStage | null;
  held: boolean;
  hasEmail: boolean;
  settings: Pick<AgentSettings, "on">;
  scheduled?: boolean;
}): OutboxState {
  if (!input.hasEmail) return "no-email";
  if (input.held) return "held";
  return input.scheduled || agentOn(input.settings, input.stage) ? "counting" : "waiting";
}

/** Whether Sol sends it now on his own: counting down, and its time has come. */
export function shouldFire(state: OutboxState, firesAtIso: string, now = new Date()): boolean {
  return state === "counting" && Date.parse(firesAtIso) <= now.getTime();
}

/** The chip on a pipeline card, in words. */
export function chipWords(state: OutboxState, firesAtIso: string, now = new Date()): string {
  switch (state) {
    case "counting":
      return `Sol emails ${countdownWords(firesAtIso, now)}`;
    case "waiting":
      return "Sol drafted · review";
    case "held":
      return "Sol held · yours to send";
    case "no-email":
      return "Sol drafted · no email on file";
  }
}

/** The words for who sent it on the deal's record and the activity line. */
export const SOL_SENDER = "sol";
export const sentBySolLine = (step: string) => `${step} follow-up on the proposal: emailed by Sol`;
