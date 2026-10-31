/**
 * Today as one pad (1 Nov 2026, Martin: Primero's Today copied across, wave 4). Across its top three tabs (Today,
 * Calendar, Pipeline) and, in the corner, the sun keeping time on the day's list. Today opens on the greeting, **Up
 * first** (the most pressing thing, from `nextUp`) with **Before you call** (what to know about that customer before
 * ringing them), **To action** (the rest) and **Your day so far** (what this member has done today). Calendar is a day's
 * agenda, stepping to the next working day; Pipeline is the deals being sold as a board, or the numbers. Sol's box sits
 * at the foot. Pure, tested.
 */
import { STAGE_LABELS, type Activity, type ActivityKind, type Customer, type Job, type JobStage } from "./crm";
import type { NextItem } from "./next-up";
import { VIC_PUBLIC_HOLIDAYS } from "../scheduling";

export const TODAY_TABS = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "pipeline", label: "Pipeline" },
] as const;
export type TodayTab = (typeof TODAY_TABS)[number]["id"];

/** The deal an item on the list is about: every item's key is "<kind>:<deal id>". */
export const jobOf = (item: Pick<NextItem, "key">): string | null => item.key.split(":")[1] || null;

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

/** "today", "yesterday", "3 days ago", "2 weeks ago", from a date to today (both YYYY-MM-DD or longer). */
export function agoWords(at: string, today: string): string {
  const days = Math.max(0, Math.round((dayOf(today) - dayOf(at)) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

const KIND_WORDS: Record<ActivityKind, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  stage: "Moved",
  proposal: "Proposal",
  message: "Message",
  order: "Order",
  invoice: "Invoice",
  reminder: "Reminder",
  service: "Service",
};

export interface BeforeCall {
  /** The deal in a line: stage, value, kW, install date. */
  deal: string;
  /** The last thing that happened with them, or null. */
  last: string | null;
  /** What is still open on the deal, plainly. */
  open: string[];
}

/**
 * What to know before ringing the customer on the list's first item (as Primero's pre-call card, from the business's
 * own record): the deal in a line, the last touch, and what is still open.
 */
export function beforeYouCall(input: { job: Job; customer: Customer; activity: readonly Activity[]; today: string }): BeforeCall {
  const { job, customer, today } = input;
  const deal = [
    STAGE_LABELS[job.stage],
    job.value ? `$${Math.round(job.value).toLocaleString("en-AU")}` : null,
    job.kw ? `${job.kw} kW` : null,
    job.installDate ? `installs ${job.installDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const mine = input.activity.filter((a) => !a.jobId || a.jobId === job.id).sort((a, b) => b.at.localeCompare(a.at));
  const latest = mine[0];
  const last = latest
    ? `${KIND_WORDS[latest.kind]} ${agoWords(latest.at, today)}: ${latest.text.replace(/\s+/g, " ").slice(0, 120)}`
    : null;
  const open: string[] = [];
  if (!customer.phone) open.push("No phone number on file");
  if (!customer.email) open.push("No email address on file");
  if (!job.owner) open.push("No one owns this deal yet");
  if (job.stage === "lead" && !job.projectId) open.push("Their roof isn't designed yet");
  if (["won", "ordered", "scheduled"].includes(job.stage) && !job.installDate) open.push("No install date booked");
  if (!latest) open.push("Nothing logged on this deal yet");
  return { deal, last, open };
}

/** What this member has done today, by kind, in the order a day reads (calls first). Kinds with nothing are left out. */
export function daySoFar(
  activity: readonly Pick<Activity, "kind" | "by">[],
  me: string,
): { kind: ActivityKind; label: string; n: number }[] {
  const by = me.toLowerCase();
  const order: ActivityKind[] = ["call", "email", "note", "proposal", "stage", "order", "service", "invoice"];
  const labels: Partial<Record<ActivityKind, [string, string]>> = {
    call: ["call logged", "calls logged"],
    email: ["email", "emails"],
    note: ["note", "notes"],
    proposal: ["proposal update", "proposal updates"],
    stage: ["deal moved", "deals moved"],
    order: ["order update", "order updates"],
    service: ["service update", "service updates"],
    invoice: ["invoice", "invoices"],
  };
  return order
    .map((kind) => {
      const n = activity.filter((a) => a.kind === kind && a.by.toLowerCase() === by).length;
      const [one, many] = labels[kind] ?? [kind, kind];
      return { kind, label: n === 1 ? one : many, n };
    })
    .filter((x) => x.n > 0);
}

/** Whether a day is a working day: not a weekend, not a Victorian public holiday. */
export function isWorkingDay(day: string): boolean {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !(day in VIC_PUBLIC_HOLIDAYS);
}

/** The working day after this one. */
export function nextWorkingDay(day: string): string {
  let at = dayOf(day);
  for (let i = 0; i < 14; i++) {
    at += DAY_MS;
    const d = new Date(at).toISOString().slice(0, 10);
    if (isWorkingDay(d)) return d;
  }
  return new Date(dayOf(day) + DAY_MS).toISOString().slice(0, 10);
}

export interface AgendaItem {
  key: string;
  kind: "install" | "reminder";
  /** "08:00" for an install (when the crew starts), a reminder's own time, or null. */
  time: string | null;
  title: string;
  line: string;
  /** The deal it is about, when there is one. */
  jobId: string | null;
}

/**
 * A day's agenda (the Calendar tab): the installs that day (from the crew's start) and this member's reminders due
 * that day, in time order. `timeOf` turns a reminder's instant into its local day and time.
 */
export function agendaFor(
  day: string,
  input: {
    jobs: readonly (Job & { customerName: string })[];
    reminders: readonly { id: string; what: string; dueAt?: string }[];
    timeOf: (iso: string) => { day: string; time: string };
  },
): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const j of input.jobs)
    if (j.installDate === day && j.stage !== "lost")
      items.push({
        key: `install:${j.id}`,
        kind: "install",
        time: "08:00",
        title: `Install for ${j.customerName}`,
        line: [j.kw ? `${j.kw} kW` : null, j.details.installer || "no installer named", j.address].filter(Boolean).join(" · "),
        jobId: j.id,
      });
  for (const r of input.reminders) {
    if (!r.dueAt) continue;
    const at = input.timeOf(r.dueAt);
    if (at.day === day)
      items.push({ key: `reminder:${r.id}`, kind: "reminder", time: at.time, title: r.what, line: "Your reminder", jobId: null });
  }
  return items.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.key.localeCompare(b.key));
}

/** The stages the Pipeline tab's board shows: everything being sold, and what has just been won. */
export const BOARD_STAGES: readonly JobStage[] = ["lead", "designed", "proposal", "won"];

/** The deals being sold as a board: each stage with its count, value and its deals, the latest changed first. */
export function pipelineBoard<J extends Job>(jobs: readonly J[], perStage = 6) {
  return BOARD_STAGES.map((stage) => {
    const at = jobs.filter((j) => j.stage === stage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: at.length,
      value: Math.round(at.reduce((n, j) => n + (j.value ?? 0), 0)),
      jobs: at.slice(0, perStage),
      more: Math.max(0, at.length - perStage),
    };
  });
}
