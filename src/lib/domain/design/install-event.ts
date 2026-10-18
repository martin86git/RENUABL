/**
 * A booked installation as a calendar event: the card the Install Scheduler
 * opens (laid out like a Google Calendar event), and the same event to put
 * in the business's own calendar, by a pre-filled Google Calendar link or an
 * .ics file. The job sheet is the description: the materials, the customer,
 * the system and the site. The Google link carries only what isn't private
 * (links are kept in browser history): the customer's phone and email go in
 * the .ics file and on the card, never in a link. Pure, tested.
 */
import type { ISODate } from "../types";

/** The installation day's hours, as installers usually work them. */
export const INSTALL_DAY = { start: "08:00", end: "16:00" } as const;
export const MARKET_ZONE = "Australia/Melbourne";

export interface InstallEventInput {
  business: string;
  jobId: string;
  date: ISODate;
  customer: { name: string; email: string; phone: string };
  address: string;
  kw: number | null;
  batteryKwh: number;
  storeys: string | null;
  installer: string | null;
  /** The system, as the deal shows it: "PV panel", "Inverter", "Roof type", … */
  system: { label: string; value: string }[];
  /** What is being installed, from the order: how many of what. */
  materials: { qty: number; item: string; sku: string }[];
  /** The deal's site notes: distributor, NMI, site access, switchboard. */
  site: { label: string; value: string }[];
  /** The deal's own page, for the link in the event. */
  link: string;
}

export interface InstallEvent {
  title: string;
  date: ISODate;
  start: string;
  end: string;
  location: string;
  /** The job sheet, in sections, for the card. */
  sections: { heading: string; lines: string[] }[];
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
  const sections = [
    { heading: "Materials", lines: input.materials.map((m) => `${m.qty} x ${m.item}${m.sku ? ` (${m.sku})` : ""}`) },
    {
      heading: "Customer",
      lines: [
        `Name: ${input.customer.name}`,
        ...(input.customer.email ? [`Email: ${input.customer.email}`] : []),
        ...(input.customer.phone ? [`Phone: ${input.customer.phone}`] : []),
        `Address: ${input.address}`,
      ],
    },
    { heading: "System", lines: input.system.map((d) => `${d.label}: ${d.value}`) },
    { heading: "Site", lines: input.site.map((d) => `${d.label}: ${d.value}`) },
  ].filter((s) => s.lines.length);
  const description = [
    ...sections.flatMap((s) => [s.heading, ...s.lines, ""]),
    ...(input.installer ? [`Installer: ${input.installer}`, ""] : []),
    `The job in full: ${input.link}`,
  ].join("\n");

  // The Google link: what isn't private, and the way back to the job for the rest.
  const stamp = (date: ISODate, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
  const shortDetails = [
    ...input.system.filter((d) => /system size|panel|inverter|battery|roof/i.test(d.label)).map((d) => `${d.label}: ${d.value}`),
    ...(input.installer ? [`Installer: ${input.installer}`] : []),
    "",
    `The job in full, with the customer's details and materials: ${input.link}`,
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

/** Text as an .ics value: commas, semicolons, backslashes and new lines escaped, long lines folded. */
function icsText(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  return escaped;
}
function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

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
