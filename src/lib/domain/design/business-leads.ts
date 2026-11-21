/**
 * RENUABL's own sales pipeline for RENUABL Business (21 Nov 2026, Martin: "a pipeline dedicated to the Renuabl business
 * as a service provider. so that new Demo requests appear as a deal stage"; kept on /admin, apart from the homeowner
 * deals in RENUABL's CRM, whose stages are a solar job's). A lead is a row of `design_leads` (a demo request, an
 * Enterprise enquiry, or someone who put their details on the self-serve demo); each comes in at the first stage and
 * staff move it on. Pure, tested.
 */

export const BUSINESS_LEAD_STAGES = ["new", "booked", "demoed", "signed-up", "won", "lost"] as const;
export type BusinessLeadStage = (typeof BUSINESS_LEAD_STAGES)[number];

export const STAGE_WORDS: Record<BusinessLeadStage, string> = {
  new: "New",
  booked: "Demo booked",
  demoed: "Demo done",
  "signed-up": "Signed up",
  won: "Won",
  lost: "Lost",
};

/** The kinds of lead that belong in the pipeline. The marketplace waiting list is interest, not a sale, so it stays out. */
export const PIPELINE_KINDS = ["demo-request", "enterprise", "demo"] as const;
export type PipelineKind = (typeof PIPELINE_KINDS)[number];

export const KIND_WORDS: Record<PipelineKind, string> = {
  "demo-request": "Demo request",
  enterprise: "Enterprise enquiry",
  demo: "Tried the demo",
};

export const isPipelineKind = (k: string): k is PipelineKind => (PIPELINE_KINDS as readonly string[]).includes(k);

/** A stage from the browser, or null. */
export const cleanStage = (raw: unknown): BusinessLeadStage | null =>
  typeof raw === "string" && (BUSINESS_LEAD_STAGES as readonly string[]).includes(raw) ? (raw as BusinessLeadStage) : null;

/** A stage read back from the database: anything missing or unknown is New. */
export const stageOf = (raw: string | null | undefined): BusinessLeadStage => cleanStage(raw) ?? "new";

export const STAFF_NOTE_MAX = 1000;

/** Staff's note on a lead: plain text with its lines kept, or "" to clear it. */
export function cleanStaffNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, STAFF_NOTE_MAX);
}

import { buildIcs, type CalendarEvent } from "../calendar";
import { LAUNCH_MARKET, marketDateTime } from "../market";

/** A booked demo: when, a link to join, and whether the lead gets a reminder too. */
export interface BookedDemo {
  /** ISO time. */
  at: string;
  /** https only, or null. */
  link: string | null;
  /** Email the lead a reminder the day before (staff are always reminded). */
  remindLead: boolean;
  /** The staff member who booked it (their reminder comes to them as well as the alert addresses). */
  by: string | null;
  staffReminded: boolean;
  leadReminded: boolean;
}

/** Staff are reminded an hour before; the lead the day before (from 24 hours out until an hour before). */
export const STAFF_REMIND_MINUTES = 60;
export const LEAD_REMIND_HOURS = 24;
/** A demo is booked no further out than this. */
export const DEMO_DAYS_AHEAD = 90;

/**
 * A demo's day and time typed by staff (Melbourne's clock) as an ISO time, or why not: it must be a real day and time,
 * still to come, and within DEMO_DAYS_AHEAD.
 */
export function cleanDemoTime(date: unknown, time: unknown, now: Date = new Date()): { at: string } | { problem: string } {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { problem: "Pick the day of the demo." };
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return { problem: "Pick the time of the demo." };
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (h > 23 || m > 59 || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return { problem: "That isn't a real day and time." };
  const at = marketDateTime(date, h, m);
  const t = Date.parse(at);
  if (t <= now.getTime()) return { problem: "That time has passed." };
  if (t > now.getTime() + DEMO_DAYS_AHEAD * 86_400_000) return { problem: `Book it within ${DEMO_DAYS_AHEAD} days.` };
  return { at };
}

/** A link to join the call: https on a public-looking host, else null ("" or anything else is no link). */
export function cleanDemoLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 300) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Which reminders are due now for a lead still at Demo booked. A window that has passed is let go, never sent late. */
export function remindersDue(stage: BusinessLeadStage, demo: BookedDemo | null, now: Date = new Date()): { staff: boolean; lead: boolean } {
  if (stage !== "booked" || !demo) return { staff: false, lead: false };
  const at = Date.parse(demo.at);
  const t = now.getTime();
  const staffFrom = at - STAFF_REMIND_MINUTES * 60_000;
  return {
    staff: !demo.staffReminded && t >= staffFrom && t < at,
    lead: demo.remindLead && !demo.leadReminded && t >= at - LEAD_REMIND_HOURS * 3_600_000 && t < staffFrom,
  };
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(d);

/** "10:00 am" in Melbourne. */
export function demoClock(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .toLowerCase();
}

/** "today at 10:00 am", "tomorrow at 10:00 am" or "Tuesday 25 November at 10:00 am", Melbourne time. */
export function demoWhen(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const day = dayKey(at);
  if (day === dayKey(now)) return `today at ${demoClock(iso)}`;
  if (day === dayKey(new Date(now.getTime() + 86_400_000))) return `tomorrow at ${demoClock(iso)}`;
  const date = new Intl.DateTimeFormat("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  return `${date} at ${demoClock(iso)}`;
}

/** How long a demo is held in the calendar. */
export const DEMO_MINUTES = 30;

/**
 * The demo as a calendar event, for the lead or for staff. One id a lead and side, so a new time sent later replaces
 * the event in a calendar that kept the first rather than adding a second.
 */
export function demoEvent(
  lead: Pick<BusinessLead, "id" | "name" | "email" | "business" | "mobile">,
  demo: Pick<BookedDemo, "at" | "link">,
  side: "lead" | "staff",
): CalendarEvent {
  const end = new Date(Date.parse(demo.at) + DEMO_MINUTES * 60_000).toISOString();
  const join = demo.link ? `Join: ${demo.link}` : "";
  if (side === "lead")
    return {
      id: `${lead.id}-demo`,
      title: "RENUABL demo",
      description: [
        "A short video call to show you round RENUABL Business.",
        join || "We'll send you the link to join, or call you, just before.",
        "If that time no longer suits, reply to the reminder email and we'll find another.",
      ].join("\n"),
      ...(demo.link ? { location: demo.link } : {}),
      start: demo.at,
      end,
    };
  const who = (lead.name || lead.email).replace(/[\u0000-\u001f]/g, " ").slice(0, 80);
  return {
    id: `${lead.id}-demo-staff`,
    title: `RENUABL demo: ${who}${lead.business ? `, ${lead.business.slice(0, 80)}` : ""}`,
    description: [`Email: ${lead.email}`, lead.mobile ? `Mobile: ${lead.mobile}` : "", join || "No link to join is on the booking."]
      .filter(Boolean)
      .join("\n"),
    ...(demo.link ? { location: demo.link } : {}),
    start: demo.at,
    end,
  };
}

/** The .ics file for a demo, to attach to its reminder. */
export function demoInvite(
  lead: Pick<BusinessLead, "id" | "name" | "email" | "business" | "mobile">,
  demo: Pick<BookedDemo, "at" | "link">,
  side: "lead" | "staff",
  now: Date = new Date(),
): { filename: string; content: string; contentType: string } {
  return { filename: "renuabl-demo.ics", content: buildIcs([demoEvent(lead, demo, side)], now), contentType: "text/calendar" };
}

/** The reminder to the lead: plain words, RENUABL's, nothing from the browser but the link staff checked. */
export function leadReminderEmail(
  lead: { name: string | null },
  demo: BookedDemo,
  now: Date = new Date(),
): { subject: string; text: string } {
  const first = (lead.name ?? "").trim().split(/\s+/)[0];
  const when = demoWhen(demo.at, now);
  return {
    subject: `Your RENUABL demo is ${when}`,
    text: [
      first ? `Hi ${first},` : "Hi,",
      "",
      `A reminder that your RENUABL demo is ${when} (Melbourne time).`,
      demo.link ? `Join here: ${demo.link}` : "We'll send you the link to join, or call you, just before.",
      "",
      "The calendar invite is attached: open it to add the demo to your calendar.",
      "",
      "If that time no longer suits, reply to this email and we'll find another.",
      "",
      "The RENUABL team",
    ].join("\n"),
  };
}

/** The reminder to staff an hour before. */
export function staffReminderEmail(
  lead: Pick<BusinessLead, "name" | "email" | "business" | "mobile" | "note" | "staffNote">,
  demo: BookedDemo,
  now: Date = new Date(),
): { subject: string; text: string } {
  const who = lead.name || lead.email;
  return {
    subject: `Demo ${demoWhen(demo.at, now)}: ${who}${lead.business ? `, ${lead.business}` : ""}`,
    text: [
      `Your RENUABL Business demo with ${who}${lead.business ? ` (${lead.business})` : ""} is ${demoWhen(demo.at, now)}.`,
      "",
      `Email: ${lead.email}`,
      lead.mobile ? `Mobile: ${lead.mobile}` : "",
      demo.link ? `Join: ${demo.link}` : "No link to join is on the booking.",
      lead.note ? `\nThey wrote: ${lead.note}` : "",
      lead.staffNote ? `Your note: ${lead.staffNote}` : "",
      "",
      demo.remindLead
        ? demo.leadReminded
          ? "They were sent a reminder."
          : "They weren't sent a reminder (booked too close)."
        : "They weren't sent a reminder.",
      "The calendar invite is attached.",
      "Move it to Demo done on /admin afterwards.",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  };
}

export interface BusinessLead {
  id: string;
  kind: PipelineKind;
  email: string;
  name: string | null;
  business: string | null;
  mobile: string | null;
  users: number | null;
  /** What they wrote, as they wrote it. */
  note: string | null;
  stage: BusinessLeadStage;
  staffNote: string | null;
  /** When it came in, and when its stage last moved (ISO). */
  at: string;
  stageAt: string | null;
  movedBy: string | null;
  /** The demo booked, when there is one. */
  demo: BookedDemo | null;
}

/** The board: every stage with its leads, newest first; one email asking twice is two cards, as it came in. */
export function leadBoard(leads: readonly BusinessLead[]): { stage: BusinessLeadStage; leads: BusinessLead[] }[] {
  const newest = [...leads].sort((a, b) => (b.stageAt ?? b.at).localeCompare(a.stageAt ?? a.at));
  const soonest = (a: BusinessLead, b: BusinessLead) => (a.demo?.at ?? "9").localeCompare(b.demo?.at ?? "9");
  return BUSINESS_LEAD_STAGES.map((stage) => {
    const here = newest.filter((l) => l.stage === stage);
    // Demo booked: the soonest demo first, those with no time after.
    return { stage, leads: stage === "booked" ? [...here].sort(soonest) : here };
  });
}

/** How many are still to act on: everything not yet won or lost. */
export const openLeads = (leads: readonly BusinessLead[]) => leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length;
