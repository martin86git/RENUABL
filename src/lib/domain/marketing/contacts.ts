/**
 * A business's marketing contacts in RENUABL Business: the people it emails, imported from a sheet or its own CRM.
 * Pure: reading an imported sheet into
 * contacts, consent under the Spam Act 2003, and who may be emailed.
 */
import { normaliseEmail } from "../accounts";
import { normaliseMobile } from "../contact";

/**
 * How each contact agreed to be emailed (Spam Act 2003, s 16 and Schedule 2):
 * - express: they asked or ticked a box to hear from us (record how and when in the note);
 * - inferred: a business address published conspicuously, with no "no marketing" note, and our message
 *   relevant to their role (the narrow "conspicuous publication" rule), or an existing business relationship;
 * - unknown: not established (a bought list usually is this until checked);
 * - none: they said no, or we know there's no consent.
 * Only express and inferred may be emailed.
 */
export const CONSENT_KINDS = ["express", "inferred", "unknown", "none"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_WORDS: Record<ConsentKind, { label: string; help: string }> = {
  express: { label: "Express", help: "They asked to hear from us, or ticked a box saying so. Note how and when." },
  inferred: {
    label: "Inferred",
    help: "A business address they publish conspicuously (website, directory) with no 'no marketing' note, and our email relates to their business; or they already deal with us.",
  },
  unknown: { label: "Not checked", help: "We don't know yet. They won't be emailed until consent is established." },
  none: { label: "No consent", help: "They said no, or we know there isn't consent. Never emailed." },
};

export const isConsentKind = (v: unknown): v is ConsentKind => typeof v === "string" && (CONSENT_KINDS as readonly string[]).includes(v);

/** The fields an imported row can fill. */
export const CONTACT_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "fullName",
  "company",
  "phone",
  "website",
  "state",
  "postcode",
  "role",
] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export const FIELD_LABELS: Record<ContactField, string> = {
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  company: "Company",
  phone: "Phone",
  website: "Website",
  state: "State",
  postcode: "Postcode",
  role: "Job title",
};

export interface ContactInput {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  website: string | null;
  state: string | null;
  postcode: string | null;
  role: string | null;
}

export interface MarketingContact extends ContactInput {
  id: string;
  source: string;
  consent: ConsentKind;
  consentNote: string | null;
  createdAt: string;
  unsubscribedAt: string | null;
  bouncedAt: string | null;
  lists: string[];
}

export interface MarketingList {
  id: string;
  name: string;
  members: number;
  emailable: number;
}

/** Column index for each field, or -1. */
export type ColumnMap = Record<ContactField, number>;

const HEADER_WORDS: Record<ContactField, RegExp> = {
  email: /^(e ?mail|e ?mail address|work e ?mail|business e ?mail|contact e ?mail)$/,
  firstName: /^(first ?name|given ?name|first|fname)$/,
  lastName: /^(last ?name|surname|family ?name|last|lname)$/,
  fullName: /^(name|full ?name|contact|contact ?name|person)$/,
  company: /^(company|company ?name|business|business ?name|organi[sz]ation|trading ?name|account ?name)$/,
  phone: /^(phone|phone ?number|mobile|mobile ?number|telephone|tel|contact ?number|cell)$/,
  website: /^(website|web|url|site|domain|web ?site)$/,
  state: /^(state|region|province)$/,
  postcode: /^(postcode|post ?code|zip|zip ?code)$/,
  role: /^(title|job ?title|role|position)$/,
};

const plainHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Guesses which column holds each field from the header row; a column is used once. */
export function guessColumns(header: string[], sample: string[][] = []): ColumnMap {
  const map = Object.fromEntries(CONTACT_FIELDS.map((f) => [f, -1])) as ColumnMap;
  const used = new Set<number>();
  const plain = header.map(plainHeader);
  for (const f of CONTACT_FIELDS) {
    const i = plain.findIndex((h, n) => !used.has(n) && HEADER_WORDS[f].test(h));
    if (i >= 0) {
      map[f] = i;
      used.add(i);
    }
  }
  // No email header: the first column whose sample cells mostly look like emails.
  if (map.email < 0 && sample.length) {
    const i = header.findIndex((_, n) => {
      if (used.has(n)) return false;
      const cells = sample.map((r) => r[n]?.trim()).filter(Boolean);
      return cells.length > 0 && cells.filter((c) => normaliseEmail(c)).length / cells.length >= 0.6;
    });
    if (i >= 0) map.email = i;
  }
  return map;
}

/** Cleans a column map sent from the browser against the header's width. */
export function cleanColumnMap(raw: unknown, width: number): ColumnMap | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const map = {} as ColumnMap;
  for (const f of CONTACT_FIELDS) {
    const v = r[f];
    map[f] = typeof v === "number" && Number.isInteger(v) && v >= 0 && v < width ? v : -1;
  }
  return map.email >= 0 ? map : null;
}

const text = (v: string | undefined, max: number) => {
  const t = (v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
};

const AU_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"];
const STATE_NAMES: Record<string, string> = {
  victoria: "VIC",
  "new south wales": "NSW",
  queensland: "QLD",
  "south australia": "SA",
  "western australia": "WA",
  tasmania: "TAS",
  "australian capital territory": "ACT",
  "northern territory": "NT",
};

export function cleanState(raw: string | null): string | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (AU_STATES.includes(up)) return up;
  return STATE_NAMES[raw.trim().toLowerCase()] ?? text(raw, 40);
}

/** A website as typed, kept only when it reads as a web address. */
export function cleanWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/\s/.test(t) || !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) return null;
  return t.slice(0, 200);
}

function splitFull(full: string | null): [string | null, string | null] {
  if (!full) return [null, null];
  const parts = full.split(" ");
  return parts.length === 1 ? [parts[0], null] : [parts[0], parts.slice(1).join(" ")];
}

export type SkipReason = "no-email" | "bad-email" | "repeat";

export const SKIP_WORDS: Record<SkipReason, string> = {
  "no-email": "No email",
  "bad-email": "Email doesn't look right",
  repeat: "Same email as an earlier row",
};

export interface ReadSheet {
  contacts: ContactInput[];
  skipped: { row: number; reason: SkipReason }[];
}

/** Turns the sheet's rows (header first) into contacts: one per email, emails checked, the rest cleaned. */
export function readContacts(rows: string[][], map: ColumnMap): ReadSheet {
  const contacts: ContactInput[] = [];
  const skipped: ReadSheet["skipped"] = [];
  const seen = new Set<string>();
  const cell = (row: string[], f: ContactField, max = 120) => (map[f] >= 0 ? text(row[map[f]], max) : null);
  rows.slice(1).forEach((row, i) => {
    const rowNo = i + 2;
    if (row.every((c) => !c?.trim())) return;
    const rawEmail = cell(row, "email", 250);
    if (!rawEmail) return skipped.push({ row: rowNo, reason: "no-email" });
    const email = normaliseEmail(rawEmail.replace(/^mailto:/i, ""));
    if (!email) return skipped.push({ row: rowNo, reason: "bad-email" });
    if (seen.has(email)) return skipped.push({ row: rowNo, reason: "repeat" });
    seen.add(email);
    const [fullFirst, fullLast] = splitFull(cell(row, "fullName"));
    const rawPhone = cell(row, "phone", 40);
    contacts.push({
      email,
      firstName: cell(row, "firstName", 60) ?? fullFirst?.slice(0, 60) ?? null,
      lastName: cell(row, "lastName", 60) ?? fullLast?.slice(0, 60) ?? null,
      company: cell(row, "company", 160),
      phone: rawPhone ? (normaliseMobile(rawPhone) ?? rawPhone) : null,
      website: cleanWebsite(cell(row, "website", 200)),
      state: cleanState(cell(row, "state", 40)),
      postcode: cell(row, "postcode", 10)?.replace(/\D/g, "").slice(0, 4) || null,
      role: cell(row, "role", 120),
    });
  });
  return { contacts, skipped };
}

/** A source name: what the import was (e.g. "Solar installers list, Nov 2026"). */
export function cleanSource(raw: unknown): string | null {
  return typeof raw === "string" ? text(raw, 120) : null;
}

export function cleanConsentNote(raw: unknown): string | null {
  return typeof raw === "string" ? text(raw, 500) : null;
}

export function cleanListName(raw: unknown): string | null {
  return typeof raw === "string" ? text(raw, 80) : null;
}

/** May this contact be sent marketing email now? */
export function mayEmail(c: Pick<MarketingContact, "consent" | "unsubscribedAt" | "bouncedAt">): boolean {
  return (c.consent === "express" || c.consent === "inferred") && !c.unsubscribedAt && !c.bouncedAt;
}

/** Why a contact won't be emailed, in a few words; null when they will. */
export function notEmailedBecause(c: Pick<MarketingContact, "consent" | "unsubscribedAt" | "bouncedAt">): string | null {
  if (c.unsubscribedAt) return "Unsubscribed";
  if (c.bouncedAt) return "Bounced";
  if (c.consent === "none") return "No consent";
  if (c.consent === "unknown") return "Consent not checked";
  return null;
}

export const contactName = (c: Pick<ContactInput, "firstName" | "lastName" | "email">) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;

/** Import limits: one sheet at a time. */
export const IMPORT_LIMITS = { bytes: 4_000_000, rows: 20_000 } as const;
