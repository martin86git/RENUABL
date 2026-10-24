/**
 * The pad on the overview's canvas (25 Oct 2026, Martin: a large pad between the greeting and the box, with four icons
 * that each show one thing): new sales leads today, sales today and month to date, installations today, and sales
 * closed this month. Days are the market's (a deal made at 11pm in Melbourne is that day's, whatever the server's
 * clock says). Pure, tested.
 */
import { todayInMarket } from "../market";
import type { ISODate } from "../types";
import type { Job } from "./crm";
import { monthPace } from "./sales-rings";

export const PAD_VIEWS = ["leads", "performance", "installs", "closed"] as const;
export type PadView = (typeof PAD_VIEWS)[number];

export const PAD_WORDS: Record<PadView, { name: string; empty: string }> = {
  leads: { name: "New leads today", empty: "No new leads yet today." },
  performance: { name: "Sales today and this month", empty: "" },
  installs: { name: "Installations today", empty: "No installations today." },
  closed: { name: "Sales closed this month", empty: "No sales closed yet this month." },
};

type PadJob = Pick<Job, "id" | "stage" | "value" | "kw" | "wonAt" | "installDate" | "createdAt">;

/** The market's day an instant falls on. */
const dayOf = (iso: string | null) => (iso ? todayInMarket(new Date(iso)) : null);

/** Deals made today, newest first (a lead is a new deal, whatever stage it has reached since). */
export function newLeadsToday<T extends PadJob>(jobs: readonly T[], today: ISODate): T[] {
  return jobs.filter((j) => dayOf(j.createdAt) === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Installations booked for today, not lost. */
export function installsToday<T extends PadJob>(jobs: readonly T[], today: ISODate): T[] {
  return jobs.filter((j) => j.installDate === today && j.stage !== "lost");
}

/** Deals sold this calendar month (and still sold), newest first. */
export function closedThisMonth<T extends PadJob>(jobs: readonly T[], today: ISODate): T[] {
  const month = today.slice(0, 7);
  return jobs
    .filter((j) => j.stage !== "lost" && dayOf(j.wonAt)?.slice(0, 7) === month)
    .sort((a, b) => (b.wonAt ?? "").localeCompare(a.wonAt ?? ""));
}

export interface SalesFigures {
  deals: number;
  value: number;
  kw: number;
}

const add = (list: readonly PadJob[]): SalesFigures => ({
  deals: list.length,
  value: Math.round(list.reduce((n, j) => n + (j.value ?? 0), 0)),
  kw: Math.round(list.reduce((n, j) => n + (j.kw ?? 0), 0) * 100) / 100,
});

/** Sales today and month to date, with where the month is heading at this pace and how far through it we are. */
export function salesToday(
  jobs: readonly PadJob[],
  today: ISODate,
): { today: SalesFigures; month: SalesFigures; projected: number; day: number; days: number } {
  const month = closedThisMonth(jobs, today);
  const sold = add(month);
  const pace = monthPace(sold.value, today);
  return { today: add(month.filter((j) => dayOf(j.wonAt) === today)), month: sold, ...pace };
}
