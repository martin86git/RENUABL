/**
 * A business's marketing in RENUABL Business: campaigns, sequences (a trigger, then emails and waits, until a stop), when
 * emails may go out, and a campaign's report. Pure and tested; the server runs them from the cron.
 */
import { LAUNCH_MARKET, marketDateTime, todayInMarket } from "../market";
import { addDaysISO, isInstallDay } from "../scheduling";
import type { ISODate } from "../types";
import { cleanContent, contentProblem, type EdmContent } from "./edm";

/** Marketing goes out on working days (weekdays, never Victorian public holidays), 9 am to 5 pm Melbourne time. */
export const SENDING_HOURS = { from: 9, until: 17 } as const;

/** At most this many emails a cron run; the daily cap is a setting (default below). */
export const BATCH_PER_RUN = 100;
export const DAILY_CAP = { default: 300, min: 10, max: 2000 } as const;

function marketHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
}

export function inSendingHours(now: Date = new Date()): boolean {
  const h = marketHour(now);
  return isInstallDay(todayInMarket(now)) && h >= SENDING_HOURS.from && h < SENDING_HOURS.until;
}

/** The next moment emails may go out: now when inside the hours. */
export function nextSendingTime(now: Date = new Date()): Date {
  if (inSendingHours(now)) return now;
  let day: ISODate = todayInMarket(now);
  if (!(isInstallDay(day) && marketHour(now) < SENDING_HOURS.from)) day = addDaysISO(day, 1);
  for (let i = 0; i < 30 && !isInstallDay(day); i++) day = addDaysISO(day, 1);
  return new Date(marketDateTime(day, SENDING_HOURS.from));
}

/** N working days on from today, at the start of the sending hours: when a sequence's wait ends. */
export function afterWorkingDays(days: number, now: Date = new Date()): Date {
  let day: ISODate = todayInMarket(now);
  let left = Math.max(1, Math.round(days));
  for (let i = 0; left > 0 && i < 400; i++) {
    day = addDaysISO(day, 1);
    if (isInstallDay(day)) left--;
  }
  return new Date(marketDateTime(day, SENDING_HOURS.from));
}

export function cleanDailyCap(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.min(DAILY_CAP.max, Math.max(DAILY_CAP.min, Math.round(n))) : DAILY_CAP.default;
}

/** How many may go this run: never past the batch, nor what's left of today's cap. */
export function roomThisRun(sentToday: number, dailyCap: number): number {
  return Math.max(0, Math.min(BATCH_PER_RUN, dailyCap - sentToday));
}

// ---- Campaigns ----

export const CAMPAIGN_STATES = ["draft", "scheduled", "sending", "sent", "cancelled"] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export const CAMPAIGN_STATE_WORDS: Record<CampaignState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

/** The word typed to send a campaign to real people: a deliberate act, never a slip. */
export const SEND_CONFIRM_WORD = "SEND";

export const SCHEDULE_DAYS_MAX = 90;

/** When a campaign should go: now (null) or a time ahead, at most 90 days out. Null result means refused. */
export function cleanSendAt(raw: unknown, now: Date = new Date()): { at: Date } | { problem: string } {
  if (raw === null || raw === undefined || raw === "") return { at: now };
  const at = new Date(String(raw));
  if (Number.isNaN(at.getTime())) return { problem: "That time doesn't read as a date." };
  if (at.getTime() < now.getTime() - 60_000) return { problem: "Pick a time from now on." };
  if (at.getTime() > now.getTime() + SCHEDULE_DAYS_MAX * 86_400_000) return { problem: `Pick a time within ${SCHEDULE_DAYS_MAX} days.` };
  return { at };
}

export interface SendCounts {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
}

export interface Report extends SendCounts {
  openRate: number | null;
  clickRate: number | null;
}

/** Rates are of those sent; opens are a guide (some mail apps load every picture, others none). */
export function reportOf(c: SendCounts): Report {
  return { ...c, openRate: c.sent ? c.opened / c.sent : null, clickRate: c.sent ? c.clicked / c.sent : null };
}

export const pct = (r: number | null) => (r === null ? "--" : `${Math.round(r * 1000) / 10}%`);

// ---- Sequences ----

export type SequenceTrigger =
  { kind: "list"; listId: string } | { kind: "opened"; campaignId: string } | { kind: "clicked"; campaignId: string };

export const TRIGGER_WORDS: Record<SequenceTrigger["kind"], string> = {
  list: "Someone joins a list",
  opened: "Someone opens a campaign",
  clicked: "Someone clicks a link in a campaign",
};

export type SequenceStep = { id: string; kind: "email"; content: EdmContent } | { id: string; kind: "wait"; days: number };

export interface SequenceStops {
  /** Always on: becoming a customer ends it (a deal of theirs sold; for RENUABL's own business, signing up to RENUABL Business). */
  signedUp: true;
  /** Clicking any email in this sequence ends it (they've engaged; a person takes over). */
  clicked: boolean;
}

export interface SequenceDraft {
  name: string;
  trigger: SequenceTrigger | null;
  steps: SequenceStep[];
  stops: SequenceStops;
}

export const SEQUENCE_LIMITS = { steps: 12, waitDays: 60, name: 80 } as const;
const ID = /^[a-z0-9_]{4,40}$/;

export function cleanTrigger(raw: unknown): SequenceTrigger | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "list" && typeof r.listId === "string" && ID.test(r.listId)) return { kind: "list", listId: r.listId };
  if ((r.kind === "opened" || r.kind === "clicked") && typeof r.campaignId === "string" && ID.test(r.campaignId))
    return { kind: r.kind, campaignId: r.campaignId };
  return null;
}

export function cleanSteps(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw)) return [];
  const out: SequenceStep[] = [];
  raw.slice(0, SEQUENCE_LIMITS.steps).forEach((s, i) => {
    if (!s || typeof s !== "object") return;
    const r = s as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9]{4,16}$/.test(r.id) ? r.id : `s${i}k${(i * 104729).toString(36)}`;
    if (r.kind === "wait") {
      const days = Math.round(Number(r.days));
      out.push({ id, kind: "wait", days: Number.isFinite(days) ? Math.min(SEQUENCE_LIMITS.waitDays, Math.max(1, days)) : 3 });
    } else if (r.kind === "email") out.push({ id, kind: "email", content: cleanContent(r.content) });
  });
  return out;
}

export function cleanSequence(raw: unknown): SequenceDraft {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const stops = (r.stops && typeof r.stops === "object" ? r.stops : {}) as Record<string, unknown>;
  return {
    name: typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim().slice(0, SEQUENCE_LIMITS.name) : "",
    trigger: cleanTrigger(r.trigger),
    steps: cleanSteps(r.steps),
    stops: { signedUp: true, clicked: stops.clicked === true },
  };
}

/** Why a sequence can't be switched on, or null. */
export function sequenceProblem(s: SequenceDraft): string | null {
  if (!s.name) return "Give it a name.";
  if (!s.trigger) return "Choose what starts it.";
  const emails = s.steps.filter((x) => x.kind === "email");
  if (!emails.length) return "Add at least one email.";
  for (const [i, step] of s.steps.entries()) {
    if (step.kind !== "email") continue;
    const p = contentProblem(step.content);
    if (p) return `Email ${s.steps.slice(0, i + 1).filter((x) => x.kind === "email").length}: ${p}`;
  }
  return null;
}

export type StopReason = "signed-up" | "unsubscribed" | "bounced" | "no-consent" | "clicked" | "finished";

export const STOP_WORDS: Record<StopReason, string> = {
  "signed-up": "Became a customer",
  unsubscribed: "Unsubscribed",
  bounced: "Email bounced",
  "no-consent": "No consent to email",
  clicked: "Clicked a link",
  finished: "Finished",
};

export interface EnrolmentFacts {
  signedUp: boolean;
  unsubscribed: boolean;
  bounced: boolean;
  mayEmail: boolean;
  clickedInSequence: boolean;
}

/** Why an enrolment ends now, or null to carry on. The order is the order of importance. */
export function stopReason(f: EnrolmentFacts, stops: SequenceStops): StopReason | null {
  if (f.signedUp) return "signed-up";
  if (f.unsubscribed) return "unsubscribed";
  if (f.bounced) return "bounced";
  if (!f.mayEmail) return "no-consent";
  if (stops.clicked && f.clickedInSequence) return "clicked";
  return null;
}

export type StepAction =
  { kind: "email"; step: number; content: EdmContent; next: Date } | { kind: "wait"; next: Date } | { kind: "finish" };

/**
 * What to do for an enrolment at `step` now: send that email (and move on at once, or after the
 * wait that follows), wait, or finish. One email is sent at a time, so a run never sends two in a row.
 */
export function stepAction(steps: SequenceStep[], step: number, now: Date = new Date()): StepAction {
  const s = steps[step];
  if (!s) return { kind: "finish" };
  if (s.kind === "wait") return { kind: "wait", next: afterWorkingDays(s.days, now) };
  return { kind: "email", step, content: s.content, next: now };
}
