/**
 * Sol's sales agents (5 Nov 2026, Martin: phase two; Sol reaching out to customers to close them, with the team able
 * to see he is at work and doing the right work). One Sol wearing a hat for each stage of the pipeline, never four
 * characters: "Sol · Proposals" and so on, each with its own job, all drawing from one outbox. What he means to send
 * waits in the outbox with the time it will go: at the business's send windows (twice a day by default), never sooner
 * than `MIN_REVIEW_MINUTES` after it was ready, so there is always time to read it, change it, hold it or skip it. He
 * sends on his own only once the business has switched sending on (off until then: the drafts wait for a press), never
 * at a paused stage or while everything is paused, and never once the customer has written or the deal has moved on.
 * Pure: no I/O.
 */
import { LAUNCH_MARKET, marketDateTime, todayInMarket } from "../market";
import type { JobStage } from "./crm";
import { isWorkingDay, nextWorkingDay } from "./today-pad";

export const AGENT_STAGES = ["lead", "designed", "proposal", "won"] as const;
export type AgentStage = (typeof AGENT_STAGES)[number];

export interface Agent {
  stage: AgentStage;
  name: string;
  /** What this agent is for, in one sentence. */
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
    job: "Gets the bill in, answers first questions and books the call.",
    working: false,
    soon: "Coming next: a first hello to new leads, and a nudge for the bill.",
  },
  designed: {
    stage: "designed",
    name: "Sol · Designs",
    job: "Gets the design checked and the indicative proposal out.",
    working: false,
    soon: "Coming next: telling you when a design is ready to send, and sending it with your note.",
  },
  proposal: {
    stage: "proposal",
    name: "Sol · Proposals",
    job: "Follows up, answers worries and guides the customer to sign.",
    working: true,
  },
  won: {
    stage: "won",
    name: "Sol · Won",
    job: "Chases the deposit and approvals, and gets the install ready.",
    working: false,
    soon: "Coming next: deposit reminders and the welcome to the install.",
  },
};

/** The board's column a deal's stage answers to, or null for one no agent works on. */
export function agentFor(stage: JobStage): AgentStage | null {
  return (AGENT_STAGES as readonly string[]).includes(stage) ? (stage as AgentStage) : null;
}

/** The send windows a business starts with, in the market's time: mid morning and early afternoon. */
export const DEFAULT_WINDOWS = ["10:00", "14:00"] as const;
/** Windows a business may choose: on the hour or half past, from 8 in the morning to 6 in the evening. */
export const WINDOW_LIMITS = { first: 8 * 60, last: 18 * 60, most: 3 } as const;
/** However close a window is, an email waits at least this long once ready, so there is time to read it. */
export const MIN_REVIEW_MINUTES = 30;

export interface AgentSettings {
  /** Whether Sol sends at the windows on his own; off, his drafts wait for someone to press send. */
  sending: boolean;
  windows: string[];
  /** Stages whose agent is paused. */
  paused: AgentStage[];
  /** Every agent paused at once. */
  pausedAll: boolean;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = { sending: false, windows: [...DEFAULT_WINDOWS], paused: [], pausedAll: false };

const minutesOf = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Settings from anywhere made whole and safe: windows on the hour or half past, inside the day, at most three. */
export function cleanAgentSettings(raw: unknown): AgentSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const windows = Array.isArray(r.windows)
    ? [...new Set(r.windows.filter((w): w is string => typeof w === "string"))]
        .filter((w) => {
          const m = minutesOf(w);
          return m !== null && m % 30 === 0 && m >= WINDOW_LIMITS.first && m <= WINDOW_LIMITS.last;
        })
        .sort()
        .slice(0, WINDOW_LIMITS.most)
    : [];
  const paused = Array.isArray(r.paused) ? AGENT_STAGES.filter((s) => (r.paused as unknown[]).includes(s)) : [];
  return {
    sending: r.sending === true,
    windows: windows.length ? windows : [...DEFAULT_WINDOWS],
    paused,
    pausedAll: r.pausedAll === true,
  };
}

/**
 * When an email that was ready at `readyAt` goes: the first send window on a working day (no weekends or Victorian
 * public holidays) at least `MIN_REVIEW_MINUTES` after it was ready.
 */
export function firesAt(readyAt: string, windows: readonly string[]): string {
  const ready = Date.parse(readyAt);
  const earliest = (Number.isNaN(ready) ? Date.now() : ready) + MIN_REVIEW_MINUTES * 60_000;
  const times = [...windows]
    .map(minutesOf)
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  const use = times.length ? times : DEFAULT_WINDOWS.map((w) => minutesOf(w) as number);
  let day = todayInMarket(new Date(earliest));
  for (let i = 0; i < 30; i++) {
    if (isWorkingDay(day)) {
      for (const m of use) {
        const at = marketDateTime(day, Math.floor(m / 60), m % 60);
        if (Date.parse(at) >= earliest) return at;
      }
    }
    day = nextWorkingDay(day);
  }
  return new Date(earliest).toISOString();
}

/** How long after its window an email may still go: Sol sends while someone has RENUABL open, never in the night. */
export const SEND_GRACE_MINUTES = 120;

/**
 * When it goes, as of now: its first window, or when that passed more than `SEND_GRACE_MINUTES` ago without it
 * going (nobody had RENUABL open), the next window instead, so nothing reaches a customer at 9 at night.
 */
export function sendAt(readyAt: string, windows: readonly string[], now = new Date()): string {
  let at = firesAt(readyAt, windows);
  for (let i = 0; i < 60 && now.getTime() > Date.parse(at) + SEND_GRACE_MINUTES * 60_000; i++)
    at = firesAt(new Date(Date.parse(at) - (MIN_REVIEW_MINUTES - 1) * 60_000).toISOString(), windows);
  return at;
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

/** The windows in words: "10 am and 2 pm". */
export function windowsWords(windows: readonly string[]): string {
  const said = windows
    .map(minutesOf)
    .filter((m): m is number => m !== null)
    .map((m) => clock(new Date(marketDateTime("2026-01-05", Math.floor(m / 60), m % 60))));
  return said.length < 2 ? (said[0] ?? "") : `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

/** Where an email in the outbox stands, for the card's chip and the agent's list. */
export type OutboxState = "counting" | "waiting" | "held" | "paused" | "no-email";

/**
 * Where it stands: counting down to its window while Sol may send; waiting for a press while sending is off; held
 * when someone held it; paused when its stage (or everything) is paused; no-email when the customer has no address.
 */
export function outboxState(input: { stage: AgentStage | null; held: boolean; hasEmail: boolean; settings: AgentSettings }): OutboxState {
  if (!input.hasEmail) return "no-email";
  if (input.held) return "held";
  if (input.settings.pausedAll || (input.stage && input.settings.paused.includes(input.stage)) || !input.stage) return "paused";
  return input.settings.sending ? "counting" : "waiting";
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
    case "paused":
      return "Sol paused";
    case "no-email":
      return "Sol drafted · no email on file";
  }
}

/** The words for who sent it on the deal's record and the activity line. */
export const SOL_SENDER = "sol";
export const sentBySolLine = (step: string) => `${step} follow-up on the proposal: emailed by Sol at the send window`;
