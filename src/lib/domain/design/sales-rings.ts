/**
 * The month's sales as rings (24 Oct 2026, Martin: as Apple would show it, its
 * Activity rings, in RENUABL's own way): sales, deals sold and kW sold, each a
 * share of the month's goal. A business sets its own monthly targets (Settings
 * → CRM → Sales targets); until it does, each goal is its own average of the
 * three months before, so a ring means something from the first day. Also the
 * six months behind them, the pace the month is on, and the open pipeline by
 * stage. Pure, tested.
 */
import { todayInMarket } from "../market";
import type { ISODate } from "../types";
import { OPEN_STAGES, WON_STAGES, type JobStage } from "./crm";
import type { DashJob } from "./deal";

export interface SalesTargets {
  /** Dollars sold a month, at quoted prices. */
  sales: number | null;
  deals: number | null;
  kw: number | null;
}
export const NO_TARGETS: SalesTargets = { sales: null, deals: null, kw: null };

/** Targets as kept: each a positive figure in range, or null. */
export function cleanTargets(raw: unknown): SalesTargets {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, max: number) => {
    const x = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[$,\s]/g, "")) : NaN;
    return Number.isFinite(x) && x > 0 && x <= max ? Math.round(x * 100) / 100 : null;
  };
  return { sales: n(r.sales, 100_000_000), deals: n(r.deals, 10_000), kw: n(r.kw, 100_000) };
}

export interface MonthFigures {
  /** YYYY-MM. */
  month: string;
  /** "Oct". */
  label: string;
  sales: number;
  deals: number;
  kw: number;
}

const two = (n: number) => String(n).padStart(2, "0");
const monthBack = (y: number, m: number, back: number) => {
  const i = y * 12 + (m - 1) - back;
  return `${Math.floor(i / 12)}-${two((i % 12) + 1)}`;
};
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** What was sold in each of the last `count` months, this one last (so far), by the month each deal was won. */
export function monthlyHistory(jobs: readonly DashJob[], today: ISODate, count = 6): MonthFigures[] {
  const [y, m] = today.split("-").map(Number);
  const months = Array.from({ length: count }, (_, i) => monthBack(y, m, count - 1 - i));
  const won = jobs
    .filter((j) => WON_STAGES.includes(j.stage) && j.wonAt)
    .map((j) => ({ ...j, month: todayInMarket(new Date(j.wonAt!)).slice(0, 7) }));
  return months.map((month) => {
    const these = won.filter((j) => j.month === month);
    return {
      month,
      label: SHORT[Number(month.slice(5)) - 1],
      sales: these.reduce((n, j) => n + (j.value ?? 0), 0),
      deals: these.length,
      kw: Math.round(these.reduce((n, j) => n + (j.kw ?? 0), 0) * 100) / 100,
    };
  });
}

export type RingKey = "sales" | "deals" | "kw";
export interface Ring {
  key: RingKey;
  value: number;
  /** What closes the ring; null when there is nothing to aim at yet (no target, no months behind). */
  goal: number | null;
  /** Where the goal came from. */
  basis: "target" | "average" | "none";
  /** value ÷ goal; past 1 the ring laps itself. 0 without a goal. */
  share: number;
}

/**
 * The month's three rings: each against the business's target, else its average of the three months before this one
 * (rounded up to a sensible figure), else nothing to aim at.
 */
export function monthRings(history: readonly MonthFigures[], targets: SalesTargets): Ring[] {
  const now = history[history.length - 1];
  const before = history.slice(-4, -1).filter((m) => m.deals > 0);
  const average = (key: RingKey) => (before.length ? before.reduce((n, m) => n + m[key], 0) / before.length : 0);
  const round = (key: RingKey, v: number) =>
    key === "sales" ? Math.ceil(v / 1000) * 1000 : key === "deals" ? Math.max(1, Math.ceil(v)) : Math.ceil(v);
  return (["sales", "deals", "kw"] as const).map((key) => {
    const target = targets[key];
    const avg = average(key);
    const goal = target ?? (avg > 0 ? round(key, avg) : null);
    const value = now?.[key] ?? 0;
    return { key, value, goal, basis: target ? "target" : goal ? "average" : "none", share: goal ? value / goal : 0 };
  });
}

/** Where the month is heading at today's rate: what is sold so far, spread over the whole month. */
export function monthPace(value: number, today: ISODate): { day: number; days: number; projected: number } {
  const [y, m, d] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { day: d, days, projected: d > 0 ? Math.round((value / d) * days) : 0 };
}

/** The deals still being sold, by stage, with how many and what they are worth: one bar split in three. */
export function pipelineByStage(jobs: readonly Pick<DashJob, "stage" | "value">[]): { stage: JobStage; deals: number; value: number }[] {
  return OPEN_STAGES.map((stage) => {
    const these = jobs.filter((j) => j.stage === stage);
    return { stage, deals: these.length, value: these.reduce((n, j) => n + (j.value ?? 0), 0) };
  });
}
