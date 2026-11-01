/**
 * The standards and regulations a solar business works to, and its own library of them (Settings → Standards and
 * regulations). Standards Australia sells the standards under licence, so RENUABL never holds or hands out a copy of
 * its own: each business uploads the copies it has bought, for its own members, and ticks that its licence covers
 * them. What a standard covers is said here in our own words; nothing of a standard's text is reproduced.
 */

export type StandardGroup = "wiring" | "batteries" | "solar" | "structure";

export interface StandardInfo {
  /** As Standards Australia writes it, without the year: the edition is the business's copy's. */
  code: string;
  title: string;
  group: StandardGroup;
  /** What it covers, in our words. */
  covers: string;
}

export const STANDARD_GROUPS: { id: StandardGroup; label: string }[] = [
  { id: "wiring", label: "Wiring and cables" },
  { id: "batteries", label: "Batteries" },
  { id: "solar", label: "Solar and inverters" },
  { id: "structure", label: "Roof and structure" },
];

export const STANDARDS: StandardInfo[] = [
  {
    code: "AS/NZS 3000",
    title: "Electrical installations (the Wiring Rules)",
    group: "wiring",
    covers: "The base rules for every electrical installation: protection, switchboards, earthing, RCDs, wiring, testing and verification.",
  },
  {
    code: "AS/NZS 3008.1.1",
    title: "Electrical installations: selection of cables (Australian conditions)",
    group: "wiring",
    covers: "Sizing cables for the current they carry, voltage drop and short-circuit temperature, by how and where they are run.",
  },
  {
    code: "AS/NZS 5139",
    title: "Electrical installations: safety of battery systems used with power conversion equipment",
    group: "batteries",
    covers: "Where a battery system may go and how: places it can't go, barriers and clearances, ventilation, isolation and signs.",
  },
  {
    code: "AS/NZS 4777.1",
    title: "Grid connection of energy systems via inverters: installation requirements",
    group: "batteries",
    covers: "Connecting inverters (solar and battery) to the grid: protection, isolation, signs, and the settings the network asks for.",
  },
  {
    code: "AS/NZS 4777.2",
    title: "Grid connection of energy systems via inverters: inverter requirements",
    group: "solar",
    covers: "What the inverter itself must do (a product standard). Inverters on the approved list are tested to it.",
  },
  {
    code: "AS/NZS 5033",
    title: "Installation and safety requirements for photovoltaic (PV) arrays",
    group: "solar",
    covers: "The DC side of solar: array wiring, string voltage and current limits, isolators, protection, cables and labels.",
  },
  {
    code: "AS/NZS 1170.2",
    title: "Structural design actions: wind actions",
    group: "structure",
    covers: "Wind loads on buildings: read with the racking maker's guide for fixing spacing and the roof's edge zones.",
  },
];

/** Code for a copy that isn't one of ours (a guideline, a network's rules, another standard). */
export const OTHER_STANDARD = "other";

/**
 * Official places to read the rules for free, or buy a standard. VERIFY the addresses each year. Accreditation moved
 * from the Clean Energy Council to Solar Accreditation Australia in 2024.
 */
export const OFFICIAL_SOURCES: { name: string; url: string; what: string }[] = [
  {
    name: "Standards Australia store",
    url: "https://store.standards.org.au/",
    what: "Buy a standard, as a single-user copy or a licence for your team.",
  },
  {
    name: "Energy Safe Victoria",
    url: "https://www.esv.vic.gov.au/",
    what: "Victoria's electrical safety regulator: licensing, certificates of electrical safety, and solar and battery safety.",
  },
  {
    name: "Victorian legislation",
    url: "https://www.legislation.vic.gov.au/",
    what: "The Electricity Safety Act 1998 and the Electricity Safety (General) Regulations, which make the Wiring Rules law here.",
  },
  {
    name: "Solar Accreditation Australia",
    url: "https://solaraccreditation.com.au/",
    what: "Accreditation, and the install and design guidelines accredited installers work to.",
  },
  {
    name: "Clean Energy Regulator",
    url: "https://cer.gov.au/",
    what: "STCs and the small-scale scheme's rules for eligible systems.",
  },
];

export const STANDARDS_LIMITS = {
  /** Each part sent is under Vercel's 4.5 MB request limit. */
  partBytes: 3 * 1024 * 1024,
  maxBytes: 60 * 1024 * 1024,
  maxCopies: 50,
} as const;

export const LICENCE_LINE = "Our licence for this copy covers everyone in our business who can open it.";
export const LICENCE_NEEDED = "Tick that your licence covers everyone in your business who can open this copy.";
export const STANDARD_TOO_BIG = "That file is too large. Use a PDF under 60 MB.";
export const STANDARD_NOT_PDF = "That file isn't a PDF. Upload the standard as the PDF you bought.";
export const STANDARDS_FULL = `Your library holds ${STANDARDS_LIMITS.maxCopies} copies. Remove one first.`;

/** A copy as the library lists it. */
export interface StandardCopy {
  id: string;
  code: string;
  title: string;
  edition: string;
  fileName: string;
  size: number;
  licenceBy: string;
  by: string;
  at: string;
}

export interface StandardInput {
  code: string;
  title: string;
  edition: string;
  fileName: string;
  size: number;
  parts: number;
}

export const partCount = (size: number) => Math.max(1, Math.ceil(size / STANDARDS_LIMITS.partBytes));
export const standardInfo = (code: string) => STANDARDS.find((s) => s.code === code) ?? null;

const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** A copy about to be uploaded, from the browser: one of our standards or another named one, an edition, and the licence ticked. */
export function cleanStandardInput(raw: Record<string, unknown>): { ok: true; value: StandardInput } | { ok: false; message: string } {
  if (raw.licence !== true) return { ok: false, message: LICENCE_NEEDED };
  const code = line(raw.code, 40);
  const info = standardInfo(code);
  if (!info && code !== OTHER_STANDARD) return { ok: false, message: "Choose which standard this is." };
  const title = info ? info.title : line(raw.title, 160);
  if (!title) return { ok: false, message: "Say what this document is." };
  const size = typeof raw.size === "number" && Number.isInteger(raw.size) ? raw.size : 0;
  if (size < 1) return { ok: false, message: STANDARD_NOT_PDF };
  if (size > STANDARDS_LIMITS.maxBytes) return { ok: false, message: STANDARD_TOO_BIG };
  const base = typeof raw.fileName === "string" ? (raw.fileName.split(/[\\/]/).pop() ?? "") : "";
  const fileName = line(base, 120) || `${info ? info.code : "standard"}.pdf`;
  return { ok: true, value: { code, title, edition: line(raw.edition, 60), fileName, size, parts: partCount(size) } };
}

/** How a copy is named: "AS/NZS 3000:2018 · Electrical installations…", or another document's own title. */
export function copyLabel(c: Pick<StandardCopy, "code" | "title" | "edition">): string {
  if (c.code === OTHER_STANDARD) return c.edition ? `${c.title} (${c.edition})` : c.title;
  return `${c.code}${c.edition ? `:${c.edition.replace(/^:/, "")}` : ""} · ${c.title}`;
}

/** What Sol is told is in the business's library: which copies are on file, and which of ours aren't. */
export function libraryForSol(copies: readonly Pick<StandardCopy, "code" | "title" | "edition">[]): string {
  const have = new Set(copies.map((c) => c.code));
  const lines = [
    copies.length
      ? `On file in Settings → Standards and regulations (the business's own licensed copies):\n${copies.map((c) => `- ${copyLabel(c)}`).join("\n")}`
      : "No copies are on file yet (Settings → Standards and regulations).",
  ];
  const missing = STANDARDS.filter((s) => !have.has(s.code));
  if (missing.length)
    lines.push(`Not on file: ${missing.map((s) => s.code).join(", ")}. They can be bought from the Standards Australia store.`);
  lines.push(`Free official sources: ${OFFICIAL_SOURCES.map((s) => `${s.name} (${s.url})`).join("; ")}.`);
  return lines.join("\n");
}

/**
 * Sol's rules for electrical regulations when he helps the business's own team (installers, designers, office). He
 * explains from what he knows; he holds no standard's text, so the business's copy and the licensed electrician have
 * the last word.
 */
export const SOL_REGULATIONS = `Electrical regulations: you know the Australian rules for solar, battery and electrical work and help the team and its installers with them: AS/NZS 3000 (Wiring Rules), AS/NZS 3008.1.1 (cable selection), AS/NZS 5033 (PV arrays), AS/NZS 4777.1 and 4777.2 (inverter connection), AS/NZS 5139 (battery systems), AS/NZS 1170.2 (wind), the Victorian Electricity Safety Act and Regulations (Energy Safe Victoria, certificates of electrical safety), the distributor's connection rules, Solar Accreditation Australia's guidelines and the Clean Energy Regulator's STC rules. Explain what the rule asks for and why, name the standard and, when you are sure of it, the clause, and say which edition you mean; editions and amendments change clause numbers and limits, so say "check it in your copy" with the clause. Use standards_on_file to see which copies the business holds. Never quote a standard's text at length (it is licensed): put it in your own words. Never say a design, site or installation complies: that is for the licensed electrician, who signs off the work, and the inspector. When a figure decides safety (a clearance, a cable size, a voltage limit) and you aren't certain of it for their edition, say so and point to the clause rather than guess. For a product's electrical figures use datasheet_lookup.`;

/** Sol's rule for regulations in a customer's proposal chat: general explanations only, never about their own home. */
export const solCustomerRegulations = (handover: string) =>
  `- You may explain in general terms what the electrical rules and standards require and why (why a battery can't go in some rooms, why a switchboard may need work, why the network can limit exports, what a certificate of electrical safety is), in your own words. Never say whether their own home, switchboard or site meets a rule, what will be done at their home, or anything a site inspection decides: that is for the team and the licensed electrician, so say so and end with ${handover} on its own line.`;
