/**
 * Approvals come before booking, and the install calendar's capacity (1 Nov 2026, Martin: Primero's copied across,
 * wave 7). Every sold job with no installation date is filed at its first gate not passed, in order: the network's
 * pre-approval, then Solar Victoria, then booking; so a job approved during the sale goes straight past. Read from the
 * deal's own Network and Financials fields (`preApproval`, `solarVicStatus`); nothing is stored. The install calendar
 * shows the next six weeks' capacity: installations booked against what the business can do in a week. Pure, tested.
 */
import { todayInMarket } from "../market";
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";
import { PRE_INSTALL_STAGES, type Job } from "./crm";
import { mondayOf } from "./design-home";

export type Gate = "preapproval" | "solarvic" | "book";
export type Tone = "through" | "waiting" | "missing";

export const GATES: { id: Gate; label: string; what: string }[] = [
  { id: "preapproval", label: "Pre-approvals", what: "Sold jobs waiting on the network's pre-approval." },
  { id: "solarvic", label: "Solar Victoria", what: "Sold jobs with a Solar Victoria application to check or in hand." },
  { id: "book", label: "Book an installation", what: "Sold jobs with both approvals through and no installation date yet." },
];

type GateJob = Pick<Job, "stage" | "installDate" | "details">;

/** The network's pre-approval in words, and whether it is through. Nothing filled in is "Not submitted". */
export function preApprovalOf(j: Pick<Job, "details">): { words: string; tone: Tone } {
  const v = j.details.preApproval || "Not submitted";
  if (v === "Approved" || v === "Approved, export limited" || v === "Not required") return { words: v, tone: "through" };
  if (v === "Declined") return { words: "Declined", tone: "missing" };
  return { words: v, tone: v === "Submitted" ? "waiting" : "missing" };
}

/** Solar Victoria in words, and whether it is through. A job showing no sign of applying is taken as not applying. */
export function solarVicOf(j: Pick<Job, "details">): { words: string; tone: Tone } {
  const v = j.details.solarVicStatus || "Not applying";
  if (v === "Eligibility to check") return { words: v, tone: "missing" };
  if (v === "Applied") return { words: "Applied, waiting", tone: "waiting" };
  return { words: v, tone: "through" };
}

/** The first gate a sold job hasn't passed; null when it isn't waiting at one (not sold, already booked, or installed). */
export function gateOf(j: GateJob): Gate | null {
  if (!PRE_INSTALL_STAGES.includes(j.stage) || j.installDate) return null;
  if (preApprovalOf(j).tone !== "through") return "preapproval";
  if (solarVicOf(j).tone !== "through") return "solarvic";
  return "book";
}

/** How many jobs wait at each gate. */
export function gateCounts(jobs: readonly GateJob[]): Record<Gate, number> {
  const out: Record<Gate, number> = { preapproval: 0, solarvic: 0, book: 0 };
  for (const j of jobs) {
    const g = gateOf(j);
    if (g) out[g]++;
  }
  return out;
}

/** The jobs at a gate, the longest waiting since they were sold first. */
export function atGate<J extends GateJob & Pick<Job, "wonAt" | "createdAt">>(jobs: readonly J[], gate: Gate): J[] {
  return jobs.filter((j) => gateOf(j) === gate).sort((a, b) => (a.wonAt ?? a.createdAt).localeCompare(b.wonAt ?? b.createdAt));
}

/** Whole days since a job was sold (or came in, for one sold before that was kept). */
export const daysWaiting = (j: Pick<Job, "wonAt" | "createdAt">, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(j.wonAt ?? j.createdAt)) / 86_400_000));

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/** What a business can install in a week until it says (Settings → Installers): a placeholder. */
export const DEFAULT_WEEKLY_CAPACITY = 5;
export const MAX_WEEKLY_CAPACITY = 100;
export const CAPACITY_WEEKS = 6;

export interface CapacityWeek {
  monday: ISODate;
  /** "This week", "Next week" or "w/c 9 Nov". */
  label: string;
  booked: number;
  canDo: number;
  full: boolean;
}

/** The next weeks from this one: installations booked against what the business can do. */
export function capacityWeeks(dates: readonly (string | null)[], canDo: number, now: Date, weeks = CAPACITY_WEEKS): CapacityWeek[] {
  const first = mondayOf(todayInMarket(now));
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDaysISO(first, i * 7);
    const sunday = addDaysISO(monday, 6);
    const booked = dates.filter((d): d is string => Boolean(d) && d! >= monday && d! <= sunday).length;
    const label =
      i === 0
        ? "This week"
        : i === 1
          ? "Next week"
          : `w/c ${new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;
    return { monday, label, booked, canDo, full: booked >= canDo };
  });
}

/** A weekly capacity as typed: a whole number from 1, else the placeholder. */
export function cleanCapacity(raw: unknown): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= MAX_WEEKLY_CAPACITY ? n : DEFAULT_WEEKLY_CAPACITY;
}
