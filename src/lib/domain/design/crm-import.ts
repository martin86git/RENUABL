/**
 * Bringing contacts and deals in from any CRM's export sheet (21 Nov 2026, Martin: "build the generic crm export import
 * for contacts and deals"; the setup wizard's step had only Pylon's import and Marketing's contact sheet to point to).
 *
 * A CSV or Excel export is read into rows. The columns are guessed from their headers (HubSpot, Pipedrive, Zoho,
 * Salesforce and plain spreadsheets name them much alike) and shown to the business to put right. Each row becomes a
 * customer, found by email and then phone so nobody is made twice and nobody already in the CRM is written over, and,
 * when the sheet is one of deals, a deal at the stage its own stage column reads as. A row is kept once: bringing the
 * same sheet in again adds nothing. Pure, tested.
 */
import { JOB_STAGES, type JobStage } from "./crm";

export const IMPORT_FIELDS = [
  "firstName",
  "lastName",
  "name",
  "email",
  "phone",
  "address",
  "suburb",
  "state",
  "postcode",
  "title",
  "stage",
  "value",
  "kw",
  "date",
  "owner",
  "source",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_WORDS: Record<ImportField, string> = {
  firstName: "First name",
  lastName: "Last name",
  name: "Full name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  suburb: "Suburb",
  state: "State",
  postcode: "Postcode",
  title: "Deal name",
  stage: "Deal stage",
  value: "Deal value",
  kw: "System size (kW)",
  date: "Sold or closed date",
  owner: "Owner's email",
  source: "Lead source",
  notes: "Notes",
};

/** The columns that make a row a deal, not only a contact. */
export const DEAL_FIELDS: readonly ImportField[] = ["title", "stage", "value", "kw", "date"];

export const IMPORT_LIMITS = { rows: 5000, batch: 40, fileBytes: 4_000_000, columns: 80, cell: 600 } as const;

export type ImportMode = "contacts" | "deals";
export const cleanImportMode = (raw: unknown): ImportMode => (raw === "deals" ? "deals" : "contacts");

/** Which column holds each field (-1: none). */
export type ImportMap = Record<ImportField, number>;

const plainHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[_\-./()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Header words for each field, tried in this order so the more particular claim their column first. */
const HEADER_WORDS: [ImportField, RegExp][] = [
  ["email", /\be ?mail\b/],
  ["firstName", /\b(first|given) ?name\b|^first$/],
  ["lastName", /\b(last|family|sur) ?name\b|^surname$|^last$/],
  ["phone", /\b(mobile|phone|cell|tel|telephone|contact number)\b/],
  ["postcode", /\b(post ?code|zip)\b/],
  ["suburb", /\b(suburb|city|town|locality)\b/],
  ["state", /\b(state|region|province)\b/],
  ["address", /\b(address|street)\b/],
  ["stage", /\b(stage|status|pipeline stage)\b/],
  ["value", /\b(amount|value|price|total|revenue)\b/],
  ["kw", /\bkw\b|\bsystem size\b|\bkilowatt/],
  ["date", /\b(close|closed|sold|won|signed) ?(date|on|at)\b|\bdate (closed|sold|won|signed)\b/],
  ["owner", /\bowner\b|\bsales ?(rep|person)\b|\bassigned\b/],
  ["source", /\b(source|channel|how did you hear)\b/],
  ["title", /\b(deal|opportunity|job|project) ?(name|title)\b|^(deal|opportunity|title)$/],
  ["notes", /\b(note|notes|comment|comments|description)\b/],
  ["name", /\bname\b|^(contact|customer|client)$/],
];

/** Guesses which column holds each field from the header row; a column is used once. */
export function guessImportColumns(header: readonly string[]): ImportMap {
  const map = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as ImportMap;
  const used = new Set<number>();
  const plain = header.map(plainHeader);
  for (const [field, words] of HEADER_WORDS) {
    const i = plain.findIndex((h, n) => !used.has(n) && words.test(h));
    if (i >= 0) {
      map[field] = i;
      used.add(i);
    }
  }
  return map;
}

/** Cleans a column map sent from the browser against the sheet's width. */
export function cleanImportMap(raw: unknown, width: number): ImportMap {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const used = new Set<number>();
  return Object.fromEntries(
    IMPORT_FIELDS.map((f) => {
      const n = r[f];
      const ok = typeof n === "number" && Number.isInteger(n) && n >= 0 && n < width && !used.has(n);
      if (ok) used.add(n);
      return [f, ok ? n : -1];
    }),
  ) as ImportMap;
}

/** Whether the sheet reads as one of deals: it has a column only a deal has. */
export const looksLikeDeals = (map: ImportMap): boolean => DEAL_FIELDS.some((f) => map[f] >= 0);

/** What stops a sheet being brought in with this map: someone has to be named or reachable. */
export function importMapProblem(map: ImportMap): string | null {
  const named = map.name >= 0 || map.firstName >= 0;
  if (!named && map.email < 0) return "Choose the column that holds each person's name or email.";
  return null;
}

/** A stage column's words as one of our stages; anything it doesn't know is a lead. */
export function stageFrom(raw: string): JobStage {
  const s = raw.toLowerCase();
  if (!s.trim()) return "lead";
  if (/\b(lost|dead|cancel|cancelled|canceled|disqualified|no sale|not interested|unqualified)\b/.test(s)) return "lost";
  if (/\b(installed|install complete|completed|complete|commissioned|finished)\b/.test(s)) return "installed";
  if (/\b(won|sold|signed|accepted|deposit|contract)\b/.test(s)) return "won";
  if (/\b(proposal|quote|quoted|quotation|presentation|negotiat)/.test(s)) return "proposal";
  if (/\b(design|designed|site visit|inspection)\b/.test(s)) return "designed";
  return JOB_STAGES.includes(s.trim() as JobStage) ? (s.trim() as JobStage) : "lead";
}

/** A money cell ("$12,345.60", "12 345") as dollars, or null. */
export function moneyFrom(raw: string): number | null {
  const s = raw.replace(/[^0-9.\-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : null;
}

/** A size cell ("6.6 kW", "6600 W", "6.6") as kW, or null. */
export function kwFrom(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(kw|w)?/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2]?.toLowerCase() === "w" || (!m[2] && n > 500)) n = n / 1000;
  return Number.isFinite(n) && n > 0 && n <= 1000 ? Math.round(n * 1000) / 1000 : null;
}

/** A date cell as YYYY-MM-DD: ISO, or day first as Australians write it (21/11/2026, 21-11-26), or "21 Nov 2026". */
export function dayFrom(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  let y = 0;
  let m = 0;
  let d = 0;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) {
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (y < 100) y += 2000;
    // 11/21/2026 can only be month first.
    if (m > 12 && d <= 12) [d, m] = [m, d];
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return "";
    const at = new Date(t);
    [y, m, d] = [at.getFullYear(), at.getMonth() + 1, at.getDate()];
  }
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const made = new Date(Date.UTC(y, m - 1, d));
  if (made.getUTCMonth() !== m - 1) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const cell = (raw: unknown, max: number): string =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** One row of the sheet, as sent to the server and read again there. */
export interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  title: string;
  stage: JobStage;
  /** The stage as the sheet wrote it, for the note. */
  stageWords: string;
  value: number | null;
  kw: number | null;
  /** Sold or closed, YYYY-MM-DD, or empty. */
  day: string;
  owner: string;
  source: string;
  notes: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A row of cells read by the map. Null when it names nobody and has no email: there is no one to keep. */
export function rowFromCells(cells: readonly string[], map: ImportMap): ImportRow | null {
  const at = (f: ImportField) => (map[f] >= 0 ? cell(cells[map[f]] ?? "", IMPORT_LIMITS.cell) : "");
  let firstName = at("firstName").slice(0, 60);
  let lastName = at("lastName").slice(0, 60);
  const whole = at("name");
  if (!firstName && whole) {
    const [first = "", ...rest] = whole.split(" ");
    firstName = first.slice(0, 60);
    lastName = lastName || rest.join(" ").slice(0, 60);
  }
  const typed = at("email").toLowerCase();
  const email = EMAIL.test(typed) ? typed.slice(0, 200) : "";
  // A phone with no real digit ("0000 000 000", "n/a") is no phone.
  const phoneCell = at("phone");
  const phone = /[1-9]/.test(phoneCell)
    ? phoneCell
        .replace(/[^0-9+ ()\-]/g, "")
        .trim()
        .slice(0, 30)
    : "";
  if (!firstName && email) firstName = email.split("@")[0]!.slice(0, 60);
  if (firstName.replace(/\s/g, "").length < 1) return null;
  if (`${firstName} ${lastName}`.trim().length < 2) lastName = lastName || "(no surname)";
  const address = [at("address"), at("suburb"), [at("state"), at("postcode")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")
    .slice(0, 200);
  const stageWords = at("stage").slice(0, 60);
  return {
    firstName,
    lastName,
    email,
    phone,
    address,
    title: at("title").slice(0, 120),
    stage: stageFrom(stageWords),
    stageWords,
    value: moneyFrom(at("value")),
    kw: kwFrom(at("kw")),
    day: dayFrom(at("date")),
    owner: EMAIL.test(at("owner").toLowerCase()) ? at("owner").toLowerCase() : "",
    source: at("source").slice(0, 40),
    notes: at("notes"),
  };
}

/** A row from the browser, read again: every field cleaned as `rowFromCells` would leave it. */
export function cleanImportRow(raw: unknown): ImportRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = (k: string, max: number) => cell(r[k], max);
  const firstName = text("firstName", 60);
  if (!firstName) return null;
  const email = text("email", 200).toLowerCase();
  const owner = text("owner", 200).toLowerCase();
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  const stage = JOB_STAGES.includes(r.stage as JobStage) ? (r.stage as JobStage) : "lead";
  return {
    firstName,
    lastName: text("lastName", 60),
    email: EMAIL.test(email) ? email : "",
    phone: text("phone", 30),
    address: text("address", 200),
    title: text("title", 120),
    stage,
    stageWords: text("stageWords", 60),
    value: num(r.value, 10_000_000),
    kw: num(r.kw, 1000),
    day: dayFrom(text("day", 12)),
    owner: EMAIL.test(owner) ? owner : "",
    source: text("source", 40),
    notes: text("notes", IMPORT_LIMITS.cell),
  };
}

/** What marks a row as the same one next time, so a sheet brought in twice adds nothing. A short hash, no secrets. */
export function rowRef(row: ImportRow, mode: ImportMode): string {
  const who = row.email || row.phone.replace(/\D/g, "") || `${row.firstName} ${row.lastName} ${row.address}`.toLowerCase();
  const what = mode === "deals" ? `|${row.title.toLowerCase()}|${row.value ?? ""}|${row.day}` : "";
  const s = `${mode}|${who}${what}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/** The deal's name when the sheet gives none. */
export const dealTitleFor = (row: ImportRow): string => row.title || (row.kw ? `Solar ${row.kw} kW` : "Solar");

/** The note kept on a deal (or a contact) saying where it came from and what the sheet said, a line each. */
export function importNote(row: ImportRow, sheet: string): string {
  const dollars = (n: number) => `$${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
  return [
    `Brought in from ${sheet || "an export sheet"}.`,
    row.stageWords && `Stage in the sheet: ${row.stageWords}.`,
    row.day && `Sold or closed: ${row.day}.`,
    row.value !== null && `Value in the sheet: ${dollars(row.value)}.`,
    row.kw && `System: ${row.kw} kW.`,
    row.source && `Lead source: ${row.source}.`,
    row.notes && `Notes: ${row.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ImportOutcome = { result: "in"; deal: boolean } | { result: "already" } | { result: "failed"; why: string };

/** What a finished run came to, in a sentence. */
export function importSummary(o: { in: number; already: number; failed: number; mode: ImportMode }): string {
  const what = o.mode === "deals" ? "deal" : "contact";
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
  return [
    `${n(o.in, what)} brought in.`,
    o.already ? `${o.already} already here, left as ${o.already === 1 ? "it was" : "they were"}.` : "",
    o.failed ? `${o.failed} couldn't be brought in.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const IMPORT_WORDS = {
  title: "Bring in contacts and deals",
  intro:
    "Upload an export from your old CRM or a spreadsheet, as CSV or Excel. Each row becomes a customer, and a deal when the sheet has deals. Nobody already here is changed, and the same sheet brought in twice adds nothing.",
  notCarried:
    "Not carried across: files, emails and call logs, roof designs, and proposals. Each deal gets a note with what the sheet said.",
  contacts: "Contacts only",
  deals: "A deal for each row",
} as const;
