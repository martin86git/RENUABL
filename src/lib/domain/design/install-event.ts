/**
 * A booked installation as a calendar event for the installer: the card the
 * Install Scheduler opens (laid out like a Google Calendar event), and the
 * same event for the business's own calendar, by a pre-filled Google
 * Calendar link or an .ics file. The description is the job sheet: what to
 * collect from which wholesaler (against which SO number), the system to be
 * installed, who to see on site, and the site's notes, each broken down
 * under its own headings.
 *
 * It is never for the customer: it lists the parts and where to collect them.
 * No one is invited by it, and the customer's email is never in it; the
 * installer gets their name, phone and address to reach them on the day.
 * The Google link carries only what isn't private (links are kept in browser
 * history): the customer's phone goes in the .ics file and on the card. Pure,
 * tested.
 */
import type { ISODate } from "../types";

/** The installation day's hours, as installers usually work them. */
export const INSTALL_DAY = { start: "08:00", end: "16:00" } as const;
export const MARKET_ZONE = "Australia/Melbourne";

/** What to collect from one wholesaler: its name, the SO number to collect against, and the parts under their headings. */
export interface Pickup {
  supplier: string | null;
  so: string;
  groups: { title: string; items: { qty: number; item: string; sku: string }[] }[];
}

export interface InstallEventInput {
  business: string;
  jobId: string;
  date: ISODate;
  customer: { name: string; phone: string };
  address: string;
  kw: number | null;
  batteryKwh: number;
  storeys: string | null;
  installer: string | null;
  pickups: Pickup[];
  /** The system to be installed, under its headings: Solar, Inverter, Battery, EV charger, Roof. */
  system: { title: string; lines: { label: string; value: string }[] }[];
  /** The deal's site notes: distributor, NMI, site access, switchboard. */
  site: { label: string; value: string }[];
  /** The deal's own page, for the link in the event. */
  link: string;
}

export interface EventGroup {
  title: string;
  /** A line under the title: "SO OSW923342". */
  note?: string;
  lines: string[];
  /** A wholesaler to collect from: the heading the parts under it belong to. */
  supplier?: boolean;
}

export interface InstallEvent {
  title: string;
  date: ISODate;
  start: string;
  end: string;
  location: string;
  /** The job sheet, in sections, each broken down under headings, for the card. */
  sections: { heading: string; groups: EventGroup[] }[];
  /** The whole job sheet as text, for the .ics file. */
  description: string;
  googleUrl: string;
  ics: string;
}

const kwText = (kw: number | null) => (kw ? `${Math.round(kw * 1000) / 1000}kW` : "");

export function installEvent(input: InstallEventInput): InstallEvent {
  const kind = input.batteryKwh > 0 ? "Solar + Battery" : "Solar";
  // "Single" reads as "Single storey", as a booking is usually titled.
  const storeys = input.storeys && !/storey/i.test(input.storeys) ? `${input.storeys} storey` : input.storeys;
  const title = [`${kind}: ${input.business}`, [kwText(input.kw), storeys, input.customer.name].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" | ");

  const sections: InstallEvent["sections"] = [
    {
      heading: "Materials",
      groups: input.pickups.flatMap((p) => [
        // Where to go, and the number to collect against; then what to pick up there, under its headings.
        {
          title: p.supplier ? `Collect from ${p.supplier}` : "Supplier not set",
          note: p.so ? `SO ${p.so}` : "SO number not entered yet",
          lines: [],
          supplier: true,
        },
        ...p.groups.map((g) => ({ title: g.title, lines: g.items.map((m) => `${m.qty} x ${m.item}${m.sku ? ` (${m.sku})` : ""}`) })),
      ]),
    },
    {
      heading: "System to be installed",
      groups: input.system
        .filter((g) => g.lines.length)
        .map((g) => ({ title: g.title, lines: g.lines.map((d) => `${d.label}: ${d.value}`) })),
    },
    {
      heading: "On site",
      groups: [
        {
          title: "Customer",
          lines: [
            `Name: ${input.customer.name}`,
            ...(input.customer.phone ? [`Phone: ${input.customer.phone}`] : []),
            `Address: ${input.address}`,
          ],
        },
        ...(input.site.length ? [{ title: "Site", lines: input.site.map((d) => `${d.label}: ${d.value}`) }] : []),
        ...(input.installer ? [{ title: "Installer", lines: [input.installer] }] : []),
      ],
    },
  ].filter((s) => s.groups.length);

  const description = [
    ...sections.flatMap((s) => [
      s.heading.toUpperCase(),
      ...s.groups.flatMap((g) => [g.title, ...(g.note ? [g.note] : []), ...g.lines, ""]),
    ]),
    `The job in full: ${input.link}`,
  ].join("\n");

  // The Google link: what isn't private, and the way back to the job for the rest.
  const stamp = (date: ISODate, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
  const shortDetails = [
    ...input.pickups.map((p) => `Collect from ${p.supplier ?? "supplier not set"}${p.so ? ` · SO ${p.so}` : ""}`),
    ...input.system.flatMap((g) =>
      g.lines.filter((d) => /size|panel$|inverter$|battery$/i.test(d.label)).map((d) => `${d.label}: ${d.value}`),
    ),
    ...(input.installer ? [`Installer: ${input.installer}`] : []),
    "",
    `The job sheet in full: ${input.link}`,
  ].join("\n");
  const googleUrl = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(input.date, INSTALL_DAY.start)}/${stamp(input.date, INSTALL_DAY.end)}`,
    ctz: MARKET_ZONE,
    location: input.address,
    details: shortDetails,
  })}`;

  return {
    title,
    date: input.date,
    start: INSTALL_DAY.start,
    end: INSTALL_DAY.end,
    location: input.address,
    sections,
    description,
    googleUrl,
    ics: icsFile({
      uid: `${input.jobId}-install@renuabl`,
      title,
      start: stamp(input.date, INSTALL_DAY.start),
      end: stamp(input.date, INSTALL_DAY.end),
      location: input.address,
      description,
    }),
  };
}

/** Text as an .ics value: commas, semicolons, backslashes and new lines escaped. */
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** A long .ics line folded at 73 characters, each fold starting with a space. */
function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

/** The event as an .ics file. It has no attendees: no one, the customer least of all, is invited by it. */
function icsFile(e: { uid: string; title: string; start: string; end: string; location: string; description: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RENUABL//Install Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=${MARKET_ZONE}:${e.start}`,
    `DTEND;TZID=${MARKET_ZONE}:${e.end}`,
    fold(`SUMMARY:${icsText(e.title)}`),
    fold(`LOCATION:${icsText(e.location)}`),
    fold(`DESCRIPTION:${icsText(e.description)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
