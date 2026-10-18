/**
 * A booked installation as a calendar event for the installer: the card the
 * Install Scheduler opens (laid out like a Google Calendar event), and the
 * same event for the business's own calendar, by a pre-filled Google
 * Calendar link or an .ics file. The description is the job sheet, in three
 * parts: where to collect (each wholesaler and its SO number), the system to
 * be installed (each part's facts and the exact items for it, each tagged
 * with the wholesaler it comes from: the system and the pick-up list are one),
 * and who to see on site.
 *
 * It is never for the customer: it lists the parts and where to collect them.
 * No one is invited by it, and the customer's email is never in it; the
 * installer gets their name, phone and address to reach them on the day.
 * The Google link and the .ics file carry the whole job sheet, as the
 * business's own bookings do; never the customer's email. Pure, tested.
 */
import type { ISODate } from "../types";

/** The installation day's hours, as installers usually work them. */
export const INSTALL_DAY = { start: "08:00", end: "16:00" } as const;
export const MARKET_ZONE = "Australia/Melbourne";

/** One item to collect, from the job's order: its part of the system and the wholesaler it comes from (null: none set). */
export interface PickupItem {
  part: string;
  qty: number;
  item: string;
  sku: string;
  supplier: string | null;
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
  /** Each wholesaler on the order, with the SO number to collect against ("" until entered). */
  pickups: { supplier: string; so: string }[];
  items: PickupItem[];
  /** The deal's system details, by key, as the deal shows them. */
  details: { key: string; label: string; value: string }[];
  /** The deal's site notes: distributor, NMI, site access, switchboard. */
  site: { label: string; value: string }[];
  /** The deal's own page, for the link in the event. */
  link: string;
}

export interface EventGroup {
  title: string;
  /** A line under the title: "SO OSW923342". */
  note?: string;
  /** Facts, as "Label: value". */
  lines: string[];
  /** Things to collect, each with where from. */
  items?: { text: string; from: string }[];
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

/**
 * The system to be installed, part by part: the order's items for each part, and the deal's facts about it. A fact the
 * items already say (the panel and how many) is shown only when there are no items for that part.
 */
const SYSTEM_PARTS: { title: string; parts: string[]; keys: string[]; withoutItems: string[] }[] = [
  {
    title: "Solar",
    parts: ["Panels"],
    keys: ["systemType", "systemSize", "optimisers", "tiltFrames"],
    withoutItems: ["panel", "panelQty"],
  },
  {
    title: "Inverter",
    parts: ["Inverters"],
    keys: ["inverterCapacity", "phases"],
    withoutItems: ["inverter", "inverterQty", "additionalInverter"],
  },
  { title: "Battery", parts: ["Battery"], keys: ["batteryStorage"], withoutItems: ["battery", "batteryQty"] },
  { title: "EV charger", parts: [], keys: ["evCharger"], withoutItems: [] },
  { title: "Roof and racking", parts: ["Racking"], keys: ["roofType", "storeys", "propertyType"], withoutItems: [] },
  { title: "Electrical", parts: ["Electrical"], keys: [], withoutItems: [] },
  { title: "Other", parts: ["Added"], keys: [], withoutItems: [] },
];
const NO_SUPPLIER = "No supplier set";

const kwText = (kw: number | null) => (kw ? `${Math.round(kw * 1000) / 1000}kW` : "");
const itemText = (m: PickupItem) => `${m.qty} x ${m.item}${m.sku ? ` (${m.sku})` : ""}`;

export function installEvent(input: InstallEventInput): InstallEvent {
  const kind = input.batteryKwh > 0 ? "Solar + Battery" : "Solar";
  // "Single" reads as "Single storey", as a booking is usually titled.
  const storeys = input.storeys && !/storey/i.test(input.storeys) ? `${input.storeys} storey` : input.storeys;
  const title = [`${kind}: ${input.business}`, [kwText(input.kw), storeys, input.customer.name].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" | ");

  // Where to go: each wholesaler, its SO number and what is there; then anything no wholesaler has been set for.
  const partWords = (items: PickupItem[]) =>
    [...new Set(items.map((i) => SYSTEM_PARTS.find((p) => p.parts.includes(i.part))?.title.toLowerCase() ?? "other"))].join(", ");
  const collect: EventGroup[] = [
    ...input.pickups.map((p) => {
      const there = input.items.filter((i) => i.supplier === p.supplier);
      return {
        title: p.supplier,
        note: p.so ? `SO ${p.so}` : "SO number not entered yet",
        lines: [`${there.length} ${there.length === 1 ? "item" : "items"}: ${partWords(there)}`],
      };
    }),
    ...(input.items.some((i) => !i.supplier)
      ? [
          {
            title: NO_SUPPLIER,
            lines: [`${input.items.filter((i) => !i.supplier).length} to source: ${partWords(input.items.filter((i) => !i.supplier))}`],
          },
        ]
      : []),
  ];

  const system: EventGroup[] = SYSTEM_PARTS.map((p) => {
    const items = input.items.filter((i) => p.parts.includes(i.part));
    const keys = items.length ? p.keys : [...p.keys, ...p.withoutItems];
    return {
      title: p.title,
      lines: keys.flatMap((k) => input.details.filter((d) => d.key === k).map((d) => `${d.label}: ${d.value}`)),
      items: items.map((i) => ({ text: itemText(i), from: i.supplier ?? NO_SUPPLIER })),
    };
  }).filter((g) => g.lines.length || g.items.length);

  const sections: InstallEvent["sections"] = [
    { heading: "Collect from", groups: collect },
    { heading: "System to be installed", groups: system },
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
      ...s.groups.flatMap((g) => [
        g.title,
        ...(g.note ? [g.note] : []),
        ...g.lines,
        ...(g.items ?? []).map((i) => `${i.text} · ${i.from}`),
        "",
      ]),
    ]),
    `The job in full: ${input.link}`,
  ].join("\n");

  // Google Calendar shows a little formatting in an event's description: the same sheet with its headings in bold.
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const descriptionHtml = [
    ...sections.map((sec) =>
      [
        `<b>${esc(sec.heading.toUpperCase())}</b>`,
        ...sec.groups.map((g) =>
          [
            `<b>${esc(g.title)}</b>`,
            ...(g.note ? [esc(g.note)] : []),
            ...g.lines.map(esc),
            ...(g.items ?? []).map((i) => `${esc(i.text)} · ${esc(i.from)}`),
          ].join("<br>"),
        ),
      ].join("<br><br>"),
    ),
    `The job in full: ${esc(input.link)}`,
  ].join("<br><br>");

  // The Google link carries the whole job sheet, as the business's own bookings do (never the customer's email).
  const stamp = (date: ISODate, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
  const googleUrl = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(input.date, INSTALL_DAY.start)}/${stamp(input.date, INSTALL_DAY.end)}`,
    ctz: MARKET_ZONE,
    location: input.address,
    details: descriptionHtml,
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
