/**
 * Entries a business puts on its install calendar by hand (10 Nov 2026, Martin: tentative installs, a day off, and the
 * like, made straight on the calendar). They sit beside the booked installations, which still come from the deals'
 * install dates: an entry never books, moves or changes a deal.
 */
import type { ISODate } from "@/lib/domain/types";

export const ENTRY_KINDS = ["tentative", "off", "note"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_WORDS: Record<EntryKind, { label: string; hint: string }> = {
  tentative: { label: "Tentative install", hint: "Pencilled in, not booked. It doesn't change the deal's install date." },
  off: { label: "Day off", hint: "Someone away, or the crew not working." },
  note: { label: "Note", hint: "Anything else to remember on the day." },
};

export interface CalendarEntry {
  id: string;
  kind: EntryKind;
  from: ISODate;
  /** The last day, the same as `from` for one day. */
  to: ISODate;
  title: string;
  note: string;
  /** Who it is about: the installer or person away. */
  who: string;
  /** A deal it is pencilled in for (a tentative install), with the customer's name to show. */
  jobId: string | null;
  customer: string | null;
  by: string;
}

export type EntryInput = Pick<CalendarEntry, "kind" | "from" | "to" | "title" | "note" | "who" | "jobId">;

/** The longest an entry may run: a month. */
export const MAX_ENTRY_DAYS = 31;
export const ENTRY_LIMITS = { title: 80, note: 500, who: 60 } as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const JOB = /^[A-Za-z0-9_-]{1,64}$/;
const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const realDate = (v: unknown): ISODate | null => {
  if (typeof v !== "string" || !DATE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : (v as ISODate);
};
const daysBetween = (a: ISODate, b: ISODate) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** An entry as sent from the browser, checked: a kind we know, real days in order, at most a month, tidy words. */
export function cleanEntryInput(raw: unknown): { ok: true; entry: EntryInput } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind = ENTRY_KINDS.find((k) => k === r.kind);
  if (!kind) return { ok: false, message: "Choose what kind of entry it is." };
  const from = realDate(r.from);
  if (!from) return { ok: false, message: "Choose the day." };
  const to = r.to === undefined || r.to === null || r.to === "" ? from : realDate(r.to);
  if (!to) return { ok: false, message: "Choose the last day." };
  if (to < from) return { ok: false, message: "The last day can't be before the first." };
  if (daysBetween(from, to) >= MAX_ENTRY_DAYS) return { ok: false, message: `An entry can run for ${MAX_ENTRY_DAYS} days at most.` };
  const title = line(r.title, ENTRY_LIMITS.title);
  if (kind === "note" && !title) return { ok: false, message: "Give the note a few words." };
  const jobId = kind === "tentative" && typeof r.jobId === "string" && JOB.test(r.jobId) ? r.jobId : null;
  return {
    ok: true,
    entry: {
      kind,
      from,
      to,
      title,
      note: typeof r.note === "string" ? r.note.trim().slice(0, ENTRY_LIMITS.note) : "",
      who: line(r.who, ENTRY_LIMITS.who),
      jobId,
    },
  };
}

/** The entries on a day. */
export const entriesOn = <T extends Pick<CalendarEntry, "from" | "to">>(entries: readonly T[], day: ISODate): T[] =>
  entries.filter((e) => e.from <= day && day <= e.to);

/** What an entry is called on the calendar: its own words, else the customer's name, else its kind. */
export function entryLabel(e: Pick<CalendarEntry, "kind" | "title" | "who" | "customer">): string {
  if (e.title) return e.title;
  if (e.kind === "tentative" && e.customer) return e.customer;
  if (e.kind === "off" && e.who) return `${e.who} off`;
  return ENTRY_WORDS[e.kind].label;
}

/** How many tentative installs fall in a week starting on `monday`, for the capacity strip. */
export const tentativeInWeek = (entries: readonly Pick<CalendarEntry, "kind" | "from" | "to">[], monday: ISODate): number => {
  const sunday = new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  return entries.filter((e) => e.kind === "tentative" && e.from <= sunday && e.to >= monday).length;
};
