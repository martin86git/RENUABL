/**
 * Sol books a meeting (16 Nov 2026, Martin: "i need sol to be able to create calendar events, create a google meet", after
 * asking him in a deal's team chat to "schedule a google meets call between me and mike, and drop the link in here").
 *
 * The event goes on the asking member's own connected Google Calendar, with a Google Meet link when wanted, and nobody
 * is invited by it: Google sends no email to anyone (`sendUpdates=none`, no guests). Sol hands back the link for the
 * member to send the customer themselves (Text <name> on the deal's chat, or an email). He books only for a time the
 * member gave or that was agreed, and only when the member's own words ask for a meeting, so nothing a customer wrote can
 * put an event in someone's calendar. Pure, tested.
 */
import { marketDateTime } from "../market";

/** The shortest and longest meeting Sol books, in minutes, and the length when none is said. */
export const MEETING_MINUTES = { min: 10, max: 240, usual: 30 } as const;

/** The member's own words ask for a meeting, a call booked or something put in their calendar. */
export const ASKS_FOR_MEETING =
  /\b(meet(ing|s)?|google meet|calendar|schedule|book (a|in|the)|set up (a|the) (call|meeting)|video call|zoom|invite|appointment|event)\b/i;

export const asksForMeeting = (text: string) => ASKS_FOR_MEETING.test(text);

export interface MeetingAsk {
  title: string;
  /** When it starts, as an instant. */
  start: string;
  /** When it ends, as an instant. */
  end: string;
  minutes: number;
  /** A Google Meet link is made with it. */
  meet: boolean;
  /** A line or two for the event's description. */
  notes: string;
}

const plain = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, max)
    : "";

/**
 * Sol's request cleaned, or why it can't be booked. `when_local` is the market's wall time as YYYY-MM-DD HH:mm; it must
 * be to come (a minute's grace) and within a year.
 */
export function cleanMeeting(
  input: Record<string, unknown>,
  now = new Date(),
): { ok: true; value: MeetingAsk } | { ok: false; message: string } {
  const title = plain(input.title, 120);
  if (!title) return { ok: false, message: "Give the meeting a title." };
  const when = plain(input.when_local, 20);
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/.exec(when);
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59)
    return { ok: false, message: "No time to book it for. Ask them what day and time, then book it (when_local as YYYY-MM-DD HH:mm)." };
  const start = new Date(marketDateTime(m[1], Number(m[2]), Number(m[3])));
  if (Number.isNaN(start.getTime())) return { ok: false, message: `"${when}" isn't a time I can read.` };
  if (start.getTime() < now.getTime() - 60_000) return { ok: false, message: "That time has already passed: ask them for another." };
  if (start.getTime() > now.getTime() + 366 * 86_400_000) return { ok: false, message: "That's more than a year away: check the date." };
  const asked = typeof input.minutes === "number" && Number.isFinite(input.minutes) ? Math.round(input.minutes) : MEETING_MINUTES.usual;
  const minutes = Math.min(MEETING_MINUTES.max, Math.max(MEETING_MINUTES.min, asked));
  const end = new Date(start.getTime() + minutes * 60_000);
  return {
    ok: true,
    value: {
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      minutes,
      meet: input.meet !== false,
      notes: plain(input.notes, 600),
    },
  };
}

/** The event as Google Calendar's insert takes it: no guests, a Meet link asked for when wanted. */
export function googleEventBody(ask: MeetingAsk, description: string, requestId: string): Record<string, unknown> {
  return {
    summary: ask.title,
    description,
    start: { dateTime: ask.start },
    end: { dateTime: ask.end },
    reminders: { useDefault: true },
    ...(ask.meet ? { conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
  };
}

/** The event's description: what it is about and who booked it, never a customer's phone or email. */
export function meetingDescription(input: { notes: string; deal?: string; dealUrl?: string | null; by: string }): string {
  return [
    input.notes,
    input.deal ? `Deal: ${input.deal}${input.dealUrl ? `\n${input.dealUrl}` : ""}` : "",
    `Booked by Sol in RENUABL for ${input.by}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The Meet link Google gave back, only one of Google Meet's own. */
export function meetLinkOf(event: {
  hangoutLink?: unknown;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}): string | null {
  const ok = (u: unknown) => (typeof u === "string" && /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i.test(u) ? u : null);
  return ok(event.hangoutLink) ?? ok(event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri) ?? null;
}
