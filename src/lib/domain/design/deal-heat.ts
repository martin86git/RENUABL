/**
 * The deal clock and the deal's temperature (1 Nov 2026, Martin: Primero's deal pulse copied across, wave 5): on a
 * deal still being sold, how many of the usual days from new lead to signed sale are left (green, amber, red by thirds,
 * then over), and hot / warm / cold from the customer's own engagement, with the reasons. On the board the deals are
 * ranked by them and the top three not cold are marked "Call first". Worked out by rule from what is on the deal, so it
 * says why and reads the same every time: a guide, never a forecast. Pure, tested.
 */
import { LAUNCH_MARKET } from "../market";
import { OPEN_STAGES, type JobStage } from "./crm";

/** The usual days from a new lead to a signed sale, until a business sets its own. */
export const LEAD_DAYS = 21;

export type ClockBand = "green" | "amber" | "red" | "over";

export interface DealClock {
  /** Days since the lead came in, day 0 the day it came in. */
  day: number;
  total: number;
  /** Days left; below 0 once past. */
  left: number;
  band: ClockBand;
  /** "12 days left", "Last day", "3 days over". */
  words: string;
}

const DAY = 86_400_000;
/** An instant's calendar day in the market, as a count of days, so a lead in at 11 pm is a day old the next morning. */
const marketDay = (at: Date) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAUNCH_MARKET.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};

/** The clock for a deal made at `created`, or null when it can't be read. */
export function dealClock(created: string, now: Date, total = LEAD_DAYS): DealClock | null {
  const at = new Date(created);
  if (!created || Number.isNaN(at.getTime())) return null;
  const days = Math.max(7, Math.round(total));
  const day = Math.max(0, marketDay(now) - marketDay(at));
  const left = days - day;
  const band: ClockBand = left < 0 ? "over" : left > (days * 2) / 3 ? "green" : left > days / 3 ? "amber" : "red";
  const words =
    left > 1 ? `${left} days left` : left === 1 ? "1 day left" : left === 0 ? "Last day" : `${-left} day${left === -1 ? "" : "s"} over`;
  return { day, total: days, left, band, words };
}

export type Heat = "hot" | "warm" | "cold";

export interface HeatReason {
  text: string;
  /** Above 0 warms the deal, below cools it. */
  weight: number;
}

export interface DealHeat {
  heat: Heat;
  score: number;
  /** Strongest first. */
  reasons: HeatReason[];
}

/** What the business's own record knows about the customer's engagement on a deal. */
export interface HeatInput {
  now: Date;
  clock: DealClock | null;
  /** What the customer wrote in the chat on their proposal. */
  theirs: { at: string; text: string }[];
  /** Emails and chat replies the business sent them. */
  ours: { at: string }[];
  /** Calls logged on the deal. */
  calls: { at: string }[];
  /** A proposal is out for them, and when they first opened it. */
  proposalOut: boolean;
  proposalOpened: boolean;
  /** An email from the deal was opened (open tracking). */
  emailOpened: boolean;
}

/** Words in what the customer last wrote that say which way they are leaning. Plain phrases only: a guide, never a verdict. */
const WARM_WORDS =
  /\b(go ahead|go-ahead|sign(ed|ing)? (it|the)|ready to (go|proceed|sign)|happy to proceed|let'?s (do|go)|when can (you|we)|book (it|us) in|lock (it|us) in|deposit|accept)\b/i;
const COLD_WORDS =
  /\b(not interested|no longer|gone with|went with|(go|going) with (another|a different)|another installer|decided against|too expensive|over (our )?budget|out of (our )?budget|cancel|hold off|put (it )?on hold|not (going )?ahead|unsubscribe|stop (emailing|contacting))\b/i;

const ago = (now: Date, at: string) => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / DAY;
};

/**
 * Hot, warm or cold: how lately they wrote, whether they answered us or we are chasing, the leaning of what they last
 * wrote, a proposal out and opened, an email opened, calls logged this week, and a deal past its clock. Hot at 4 and
 * over, cold below 0; nothing either way is warm.
 */
export function dealHeat(x: HeatInput): DealHeat {
  const reasons: HeatReason[] = [];
  const add = (weight: number, text: string) => weight && reasons.push({ weight, text });
  const theirs = [...x.theirs].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const ours = [...x.ours].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const last = theirs[0];
  const lastAgo = last ? ago(x.now, last.at) : Infinity;
  const days = (n: number) => (n < 1 ? "today" : n < 2 ? "yesterday" : `${Math.floor(n)} days ago`);
  if (lastAgo <= 3) add(3, `Wrote to us ${days(lastAgo)}`);
  else if (lastAgo <= 7) add(2, `Wrote to us ${days(lastAgo)}`);
  else if (lastAgo <= 14) add(1, `Last wrote ${days(lastAgo)}`);
  else if (last) add(-1, `Hasn't written in ${Math.floor(lastAgo)} days`);
  const since = ours.filter((e) => !last || Date.parse(e.at) > Date.parse(last.at));
  if (last && since.length === 0 && ours.length) add(1, "Answered our last message");
  if (since.length >= 2 && ago(x.now, since[0].at) >= 3) add(-2, `${since.length} of our messages unanswered`);
  else if (!last && ours.length >= 1 && ago(x.now, ours[0].at) >= 3) add(-1, "Hasn't replied to us");
  if (last) {
    if (COLD_WORDS.test(last.text)) add(-3, "Their latest message reads as stepping back");
    else if (WARM_WORDS.test(last.text)) add(2, "Their latest message reads as ready to go");
  }
  if (x.proposalOut) add(1, "Has a proposal");
  if (x.proposalOut && x.proposalOpened) add(1, "Opened their proposal");
  if (x.emailOpened) add(1, "Opened an email from us");
  if (x.calls.some((c) => ago(x.now, c.at) <= 7)) add(1, "A call logged this week");
  if (!last && x.clock && x.clock.day >= 7 && !x.calls.length) add(-1, "Not a word from them yet");
  if (x.clock?.band === "over") add(-1, "Past the usual time to close");
  const score = reasons.reduce((n, r) => n + r.weight, 0);
  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { heat: score >= 4 ? "hot" : score >= 0 ? "warm" : "cold", score, reasons };
}

/** A deal's place on the board: its reading, its clock, and its rank among the deals on show. */
export interface DealPulse {
  heat: DealHeat;
  clock: DealClock;
  priority: number;
  /** 1, 2, 3 for the deals to ring first; absent for the rest. */
  rank?: number;
}

/** Whether a stage is still being sold, and so has a clock and a temperature. */
export const hasPulse = (stage: JobStage) => OPEN_STAGES.includes(stage);

/** The reading leads (every point of heat outweighs the clock); within the same heat, fewer days left comes first. */
export function boardPriority(heat: DealHeat, clock: DealClock): number {
  const urgency = clock.left < 0 ? -1 : 1 - clock.left / clock.total;
  return heat.score * 10 + urgency * 5;
}

export const RING_FIRST = 3;

/** Marks the top `RING_FIRST` deals that aren't cold "Call first" (1, 2, 3). */
export function rankPulses(pulses: Record<string, DealPulse>): Record<string, DealPulse> {
  const top = Object.entries(pulses)
    .filter(([, p]) => p.heat.heat !== "cold")
    .sort((a, b) => b[1].priority - a[1].priority)
    .slice(0, RING_FIRST)
    .map(([id]) => id);
  return Object.fromEntries(Object.entries(pulses).map(([id, p]) => [id, top.includes(id) ? { ...p, rank: top.indexOf(id) + 1 } : p]));
}
