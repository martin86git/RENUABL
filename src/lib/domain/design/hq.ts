/**
 * RENUABL admin, inside the product (27 Nov 2026, Martin: flick between the demo account, which shows RENUABL as a
 * solar business sees it, and his own, with what runs the platform business: who asked for a demo, support tickets,
 * the emails that came in, and the businesses signed up). Staff only. Pure, tested.
 */
export const HQ_PATH = "/design/hq";

export const HQ_TABS = [
  { id: "enquiries", label: "Enquiries" },
  { id: "tickets", label: "Support tickets" },
  { id: "emails", label: "Emails" },
  { id: "businesses", label: "Businesses" },
] as const;
export type HqTab = (typeof HQ_TABS)[number]["id"];

export const cleanHqTab = (raw: unknown): HqTab => HQ_TABS.find((t) => t.id === raw)?.id ?? "enquiries";

/**
 * Someone who put their hand up: booked a demo, gave their details in a demo account (while those could be opened),
 * asked sales about Enterprise, or joined the Marketplace list.
 */
export interface HqLead {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  business: string | null;
  mobile: string | null;
  users: number | null;
  note: string | null;
  at: string;
}

export const LEAD_WORDS: Record<string, string> = {
  "demo-request": "Book a demo",
  demo: "Demo account",
  enterprise: "Talk to sales",
  marketplace: "Marketplace list",
};
export const leadWords = (kind: string) => LEAD_WORDS[kind] ?? "Enquiry";

/** The kinds on show as filter chips, in the order worth acting on, only those that have someone in them. */
export function leadKinds(leads: readonly Pick<HqLead, "kind">[]): string[] {
  const had = new Set(leads.map((l) => l.kind));
  const known = Object.keys(LEAD_WORDS).filter((k) => had.has(k));
  return [...known, ...[...had].filter((k) => !(k in LEAD_WORDS)).sort()];
}

/** How many came in over the last `days` days. */
export function recentLeads(leads: readonly Pick<HqLead, "at">[], now: Date, days = 7): number {
  const from = now.getTime() - days * 86_400_000;
  return leads.filter((l) => new Date(l.at).getTime() >= from).length;
}

/** A made-up business: a demo someone opened, or a sample staff look through. Never counted as signed up. */
export const isMadeUpOwner = (owner: string | null) => !!owner && owner.toLowerCase().endsWith(".example");
export const isDemoOwner = (owner: string | null) => !!owner && owner.toLowerCase().endsWith("@demo.renuabl.example");
