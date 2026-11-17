/**
 * Server only. The meetings Sol puts to a member as a card (domain/design/sol-meeting.ts), business id first: proposed
 * by his tool, booked in the member's own Google Calendar only on their press, then the reminder they chose, said in
 * their own conversation with Sol when it falls due.
 */
import { randomBytes } from "node:crypto";
import {
  cleanMeeting,
  meetingDescription,
  meetingWhen,
  reminderWhat,
  remindChoices,
  type MeetingAsk,
  type MeetingView,
} from "@/lib/domain/design/sol-meeting";
import { withReminder } from "@/lib/domain/design/sol";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import { addActivity, jobById } from "./design-crm-repo";
import { newSolId, withSol } from "./design-sol-repo";
import { bookMeeting, CalendarOff } from "./my-calendar";
import type { DealViewer } from "@/lib/domain/design/account";

type Who = { businessId: string; email: string };

interface Row {
  id: string;
  email: string;
  job: string | null;
  title: string;
  start: string;
  minutes: number;
  meet: boolean;
  notes: string;
  agreed: string | null;
  agreed_day: string | null;
  state: string;
  meet_link: string | null;
  event_link: string | null;
  remind: number | null;
}

const COLS = `id, email, job_id as job, title, to_char(start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as start, minutes,
  meet, notes, agreed, agreed_day, state, meet_link, event_link, remind`;

const viewOf = (r: Row): MeetingView => ({
  id: r.id,
  title: r.title,
  start: r.start,
  minutes: r.minutes,
  meet: r.meet,
  forEmail: r.email,
  jobId: r.job,
  agreed: r.agreed,
  agreedDay: r.agreed_day,
  state: r.state === "booked" ? "booked" : r.state === "dropped" ? "dropped" : "asked",
  meetLink: r.meet_link,
  eventLink: r.event_link,
  remind: r.remind,
});

async function rowOf(businessId: string, id: string): Promise<Row | null> {
  const rows = await query<Row>(`select ${COLS} from design_meetings where business_id = $1 and id = $2`, [businessId, id]);
  return rows[0] ?? null;
}

/** Sol's proposal kept for the card; nothing is booked. */
export async function proposeMeeting(
  who: Who,
  ask: MeetingAsk,
  more: { jobId: string | null; agreed: string | null; agreedDay: string | null },
): Promise<string> {
  const id = `mt_${randomBytes(8).toString("hex")}`;
  await query(
    `insert into design_meetings (business_id, id, email, job_id, title, start_at, minutes, meet, notes, agreed, agreed_day)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      who.businessId,
      id,
      who.email.toLowerCase(),
      more.jobId,
      ask.title,
      ask.start,
      ask.minutes,
      ask.meet,
      ask.notes,
      more.agreed,
      more.agreedDay,
    ],
  );
  return id;
}

/**
 * A meeting for a member of its business. One on a deal is shown only to someone who may see that deal; anyone else
 * in the business, and every other business, gets nothing.
 */
export async function meetingFor(businessId: string, id: string, viewer: DealViewer): Promise<MeetingView | null> {
  const r = await rowOf(businessId, id);
  if (!r) return null;
  if (r.job && !(await jobById(businessId, r.job, viewer))) return null;
  return viewOf(r);
}

export type MeetingAnswer = { ok: true; meeting: MeetingView } | { ok: false; message: string; status: number };

const notYours = { ok: false as const, message: "Only the person whose calendar it goes in can do that.", status: 403 };

/** The member's press: books it in their own Google Calendar at the day and time on the card, Meet link and all. */
export async function bookProposed(who: Who, id: string, when: { day: string; time: string; minutes?: number }): Promise<MeetingAnswer> {
  const r = await rowOf(who.businessId, id);
  if (!r) return { ok: false, message: "That meeting isn't there any more.", status: 404 };
  if (r.email !== who.email.toLowerCase()) return notYours;
  if (r.state === "booked") return { ok: true, meeting: viewOf(r) };
  const clean = cleanMeeting({
    title: r.title,
    when_local: `${when.day} ${when.time}`,
    minutes: when.minutes ?? r.minutes,
    meet: r.meet,
    notes: r.notes,
  });
  if (!clean.ok) return { ok: false, message: clean.message, status: 400 };
  const deal = r.job ? await jobById(who.businessId, r.job) : null;
  const site = siteUrl();
  const description = meetingDescription({
    notes: clean.value.notes,
    deal: deal ? `${deal.customer.name} · ${deal.job.title}` : undefined,
    dealUrl: deal && site ? `${site}/design/deals/${deal.job.id}` : null,
    by: who.email,
  });
  let booked;
  try {
    booked = await bookMeeting(who, clean.value, description);
  } catch (e) {
    if (e instanceof CalendarOff)
      return { ok: false, message: e.message.replace(/^Their/, "Your").replace(/they connect/, "connect"), status: 409 };
    console.error("booking a meeting failed", e instanceof Error ? e.message : e);
    return { ok: false, message: "Google Calendar didn't answer. Try again in a moment.", status: 502 };
  }
  const rows = await query<Row>(
    `update design_meetings set state = 'booked', start_at = $3, minutes = $4, meet_link = $5, event_link = $6
     where business_id = $1 and id = $2 returning ${COLS}`,
    [who.businessId, id, clean.value.start, clean.value.minutes, booked.meet, booked.link],
  );
  if (deal)
    await addActivity(
      who.businessId,
      deal.customer.id,
      {
        jobId: deal.job.id,
        kind: "note",
        text: `Meeting booked in ${who.email}'s calendar: ${clean.value.title}, ${meetingWhen(clean.value.start)}${booked.meet ? ` · ${booked.meet}` : ""}`,
      },
      "sol",
    ).catch(() => undefined);
  return { ok: true, meeting: viewOf(rows[0]) };
}

/** Not now: the card says it wasn't booked. */
export async function dropMeeting(who: Who, id: string): Promise<MeetingAnswer> {
  const r = await rowOf(who.businessId, id);
  if (!r) return { ok: false, message: "That meeting isn't there any more.", status: 404 };
  if (r.email !== who.email.toLowerCase()) return notYours;
  if (r.state === "booked") return { ok: false, message: "It's already booked: take it out in your calendar.", status: 409 };
  const rows = await query<Row>(`update design_meetings set state = 'dropped' where business_id = $1 and id = $2 returning ${COLS}`, [
    who.businessId,
    id,
  ]);
  return { ok: true, meeting: viewOf(rows[0]) };
}

/** A reminder some minutes before a booked call, said in the member's own chat with Sol when it falls due. */
export async function remindBefore(who: Who, id: string, minutes: number): Promise<MeetingAnswer> {
  const r = await rowOf(who.businessId, id);
  if (!r) return { ok: false, message: "That meeting isn't there any more.", status: 404 };
  if (r.email !== who.email.toLowerCase()) return notYours;
  if (r.state !== "booked") return { ok: false, message: "Book it first.", status: 409 };
  if (!remindChoices(r.start).includes(minutes)) return { ok: false, message: "That time has already passed.", status: 400 };
  const view = viewOf(r);
  const dueAt = new Date(Date.parse(r.start) - minutes * 60_000).toISOString();
  await withSol(who.businessId, who.email, (row) => ({
    ...row,
    reminders: withReminder(row.reminders, {
      id: newSolId(),
      what: reminderWhat(view, minutes),
      createdAt: new Date().toISOString(),
      dueAt,
    }),
  }));
  const rows = await query<Row>(`update design_meetings set remind = $3 where business_id = $1 and id = $2 returning ${COLS}`, [
    who.businessId,
    id,
    minutes,
  ]);
  return { ok: true, meeting: viewOf(rows[0]) };
}
