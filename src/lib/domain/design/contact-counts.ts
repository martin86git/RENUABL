/**
 * How many people the business has, for Sol to answer an admin (23 Nov 2026, Martin, from his iPhone: "How many
 * contacts do I have since I performed the Pylon API import?"). The figures are read on the server
 * (server/design-contact-counts.ts); this says them in words Sol can answer from. A customer is someone with a job
 * installed and a contact everyone else, as on the Customers page (customers.ts); made-up sample customers are left out.
 */

export interface ImportRun {
  /** Where they came from: "pylon" (the API key or Pylon's export) or "sheet" (another CRM's export). */
  source: string;
  /** How many people or deals it brought in. */
  brought: number;
  /** The first and last day it ran, in the market's time (YYYY-MM-DD). */
  first: string;
  last: string;
}

export interface ContactCounts {
  /** Everyone on the books, not samples. */
  people: number;
  /** Of them, with a job installed. */
  customers: number;
  /** By where they came from ("Pylon", "Lead inbox", "Rang our number"…), largest first. */
  bySource: readonly { source: string; people: number }[];
  imports: readonly ImportRun[];
  /** Added after the last import of each kind finished, not by an import. */
  sinceImport: readonly { source: string; after: string; people: number }[];
  /** When a day was asked about: added since it (that day included). */
  since: { day: string; people: number; customers: number } | null;
}

const IMPORT_NAMES: Record<string, string> = { pylon: "Pylon", sheet: "a CRM export sheet" };

/** A day typed as YYYY-MM-DD, else null. */
export function cleanSinceDay(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(`${m[0]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0] ? null : m[0];
}

/** The counts in words, for Sol's tool. */
export function contactCountsWords(c: ContactCounts): string {
  const lines = [
    `People on the books: ${c.people} (${c.customers} customers with a job installed, ${c.people - c.customers} contacts). Made-up sample customers are left out.`,
  ];
  if (c.bySource.length)
    lines.push(`By where they came from: ${c.bySource.map((b) => `${b.source || "not recorded"} ${b.people}`).join(", ")}.`);
  if (!c.imports.length) lines.push("Nothing has been brought in from Pylon or a CRM export sheet.");
  for (const run of c.imports) {
    const name = IMPORT_NAMES[run.source] ?? run.source;
    const when = run.first === run.last ? `on ${run.first}` : `from ${run.first} to ${run.last}`;
    lines.push(`Brought in from ${name} ${when}: ${run.brought} records.`);
  }
  for (const after of c.sinceImport) {
    const name = IMPORT_NAMES[after.source] ?? after.source;
    lines.push(`Added since the last ${name} import finished (${after.after}), not by an import: ${after.people}.`);
  }
  if (c.since)
    lines.push(`Added since ${c.since.day} (that day included): ${c.since.people}, of whom ${c.since.customers} now have a job installed.`);
  return lines.join("\n");
}
