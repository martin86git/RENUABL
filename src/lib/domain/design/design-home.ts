/**
 * The design tool's home (1 Nov 2026, Martin: Primero's copied across, wave 6). Opened with no roof, the design tool is
 * one search (a deal, or the address of a new site), what has been designed today and this week, the deals waiting
 * for a design, the roofs designed lately, and the sites drawn that aren't on a deal yet. Dedicated designers are fed
 * from the waiting list: every deal still being sold that has no design, the longest waiting first. Pure, tested.
 */
import { todayInMarket } from "../market";
import { addDaysISO } from "../scheduling";
import type { ISODate } from "../types";
import { OPEN_STAGES, type JobStage } from "./crm";

/** How far back the waiting list looks, in days; null for every deal. */
export const WAITING_WINDOWS = [7, 30, 90, null] as const;
export type WaitingWindow = (typeof WAITING_WINDOWS)[number];
export const DEFAULT_WAITING: WaitingWindow = 30;
export const windowLabel = (w: WaitingWindow) => (w === null ? "All" : `${w} days`);

/** Waiting this many days or more is marked late. */
export const LATE_DAYS = 2;

export interface WaitingInput {
  id: string;
  customerName: string;
  title: string;
  address: string;
  lat: number | null;
  lng: number | null;
  stage: JobStage;
  projectId: string | null;
  createdAt: string;
}

export interface Waiting extends WaitingInput {
  /** Whole days since the deal came in. */
  days: number;
  late: boolean;
  /** Whether it has a place on the map to design on (without one, an address is added first). */
  placed: boolean;
}

const DAY = 86_400_000;

/**
 * Deals waiting for a design: still being sold, no design yet, came in within the window. The longest waiting first,
 * and how many older ones the window leaves out.
 */
export function toDesign(jobs: readonly WaitingInput[], now: Date, window: WaitingWindow): { list: Waiting[]; older: number } {
  const open = jobs
    .filter((j) => OPEN_STAGES.includes(j.stage) && !j.projectId)
    .map((j) => {
      const days = Math.max(0, Math.floor((now.getTime() - Date.parse(j.createdAt)) / DAY));
      return { ...j, days, late: days >= LATE_DAYS, placed: j.lat !== null && j.lng !== null };
    });
  const within = open.filter((j) => window === null || j.days < window);
  return { list: within.sort((a, b) => b.days - a.days || a.createdAt.localeCompare(b.createdAt)), older: open.length - within.length };
}

/** "Waiting 3 days", "In today". */
export const waitedWords = (days: number) => (days === 0 ? "In today" : `Waiting ${days} ${days === 1 ? "day" : "days"}`);

/** A design is done the day its deal's first proposal goes out: publishing again doesn't count twice. */
export interface FirstSent {
  jobId: string;
  customerName: string;
  at: string;
}

export interface DayBar {
  day: ISODate;
  /** "Mon". */
  label: string;
  count: number;
  today: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The Monday of the week a day is in. */
export function mondayOf(day: ISODate): ISODate {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDaysISO(day, -((d + 6) % 7));
}

/**
 * Designs completed: those done today (by name), and the working week as a count a day, Monday to Friday, with
 * Saturday and Sunday only when something was done on them.
 */
export function designsDone(sent: readonly FirstSent[], now: Date): { today: FirstSent[]; week: DayBar[]; weekTotal: number } {
  const today = todayInMarket(now);
  const monday = mondayOf(today);
  const dayOf = (at: string) => todayInMarket(new Date(at));
  const days = WEEKDAYS.map((label, i) => {
    const day = addDaysISO(monday, i);
    return { day, label, count: sent.filter((s) => dayOf(s.at) === day).length, today: day === today };
  });
  const week = days.filter((d, i) => i < 5 || d.count > 0 || d.today);
  return {
    today: sent.filter((s) => dayOf(s.at) === today).sort((a, b) => b.at.localeCompare(a.at)),
    week,
    weekTotal: days.reduce((n, d) => n + d.count, 0),
  };
}

/** A roof drawn in the design tool, as the home lists it. */
export interface SiteLine {
  id: string;
  address: string;
  lat: number;
  lng: number;
  panels: number;
  kw: number;
  updatedAt: string;
  /** The deal it is on, by the roof they share; null for a site only. */
  jobId: string | null;
  customerName: string | null;
  /** Whether a proposal has gone out from it. */
  published: boolean;
}

export const siteState = (s: Pick<SiteLine, "jobId" | "published">) => (s.published ? "Published" : s.jobId ? "On a deal" : "Site only");

/** The most roofs the home lists as recent. */
export const RECENT_SITES = 12;

/** The roofs designed lately, newest first; and those not on a deal yet. */
export function sitesOf(sites: readonly SiteLine[]): { recent: SiteLine[]; loose: SiteLine[] } {
  const newest = [...sites].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { recent: newest.slice(0, RECENT_SITES), loose: newest.filter((s) => !s.jobId) };
}

/**
 * Whether a site can be put on a deal: only a deal with no design and no place of its own yet (a deal with a place
 * finds its roof by itself, and a design already on a deal is never written over). Null when it can.
 */
export function attachRefusal(job: { lat: number | null; lng: number | null; projectId: string | null }): string | null {
  if (job.projectId) return "That deal already has a design. Open it from the deal instead.";
  if (job.lat !== null && job.lng !== null)
    return "That deal is at an address of its own. Open its design from the deal: a roof is found by its address.";
  return null;
}

/** The deals a site can be put on: still being sold, with no design and no place yet. */
export const attachable = <J extends { stage: JobStage; lat: number | null; lng: number | null; projectId: string | null }>(
  jobs: readonly J[],
) => jobs.filter((j) => OPEN_STAGES.includes(j.stage) && attachRefusal(j) === null);
