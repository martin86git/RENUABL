/** Calendar events for the customer: an .ics file (Apple, Outlook) and a Google Calendar link. Pure and tested. */
import { marketDateTime } from "./market";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location?: string;
  /** UTC ISO timestamps. */
  start: string;
  end: string;
}

/** 20261023T200000Z */
function stamp(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded (RFC 5545). */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(events: CalendarEvent[], now: Date = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RENUABL//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@renuabl.com.au`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.description,
    ...(e.location ? { location: e.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** The install day: installers arrive 7–9am; blocked out 7am–3pm. */
export function installEvent(opts: { reference: string; date: string; installer?: string; address?: string }): CalendarEvent {
  return {
    id: `${opts.reference}-install`,
    title: "Solar installation (RENUABL)",
    description: `${opts.installer ? `${opts.installer} arrives` : "Your installation partner arrives"} between 7am and 9am. Most installs finish the same day. Reservation ${opts.reference}.`,
    location: opts.address,
    start: marketDateTime(opts.date, 7),
    end: marketDateTime(opts.date, 15),
  };
}

/** The 15-minute confirmation call, at a "HH:MM" Melbourne time. */
export function callEvent(opts: { reference: string; date: string; time: string }): CalendarEvent {
  const [h, m] = opts.time.split(":").map(Number);
  const start = marketDateTime(opts.date, h, m);
  return {
    id: `${opts.reference}-call`,
    title: "RENUABL 15-minute system confirmation call",
    description: `We'll call you to confirm your roof, switchboard and access. Not a sales call. Reservation ${opts.reference}.`,
    start,
    end: new Date(new Date(start).getTime() + 15 * 60_000).toISOString(),
  };
}
