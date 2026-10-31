/**
 * Customers and contacts, and the group email (1 Nov 2026, Martin: Primero's copied across, wave 5). A **customer** is
 * someone with a job that has been installed (and not lost); everyone else is a **contact** (leads and prospects).
 * Each shows what their jobs put in (solar, battery, EV charger), read from the deal's own details, never more than
 * they say; the list can be filtered by them ("with solar and without a battery"). A group email goes to the people on
 * show who have an email address and haven't unsubscribed, each greeted by name, each with a link of their own to stop
 * group emails. Pure, tested.
 */
import { INSTALLED_STAGES, type JobStage } from "./crm";

export interface CustomerHas {
  solar: boolean;
  battery: boolean;
  ev: boolean;
}

const none = (v: string | null | undefined) => !v || /^(none|no|n\/a|-|0)$/i.test(v.trim());

/** What one job put in: solar from its kW or system type, a battery and an EV charger from its details or its title. */
export function jobHas(j: { kw: number | null; title: string; details: Record<string, string> }): CustomerHas {
  const type = (j.details.systemType ?? "").toLowerCase();
  const title = j.title.toLowerCase();
  const solar = type ? type.includes("solar") : (j.kw ?? 0) > 0 || /\bsolar\b/.test(title);
  const battery = type.includes("battery") || !none(j.details.battery) || /\bbatter(y|ies)\b/.test(title);
  const ev = !none(j.details.evCharger) || /\bev\b|\bcharger\b/.test(title);
  return { solar, battery, ev };
}

/** Everything across a person's jobs. */
export const together = (jobs: readonly CustomerHas[]): CustomerHas => ({
  solar: jobs.some((j) => j.solar),
  battery: jobs.some((j) => j.battery),
  ev: jobs.some((j) => j.ev),
});

/** A customer: someone with a job that has been installed. */
export const isCustomer = (stages: readonly JobStage[]) => stages.some((s) => INSTALLED_STAGES.includes(s));

export const PEOPLE_TABS = [
  { id: "customers", label: "Customers" },
  { id: "contacts", label: "Contacts" },
] as const;
export type PeopleTab = (typeof PEOPLE_TABS)[number]["id"];

export const HAS_FILTERS = [
  { key: "solar", label: "Solar" },
  { key: "battery", label: "Battery" },
  { key: "ev", label: "EV charger" },
] as const;
export type HasKey = (typeof HAS_FILTERS)[number]["key"];
/** Each left alone, must be had (true), or must not be (false). */
export type HasFilter = Partial<Record<HasKey, boolean>>;

export const matchesHas = (has: CustomerHas, f: HasFilter) => HAS_FILTERS.every(({ key }) => f[key] === undefined || has[key] === f[key]);

/** The next state of one filter: any → has → hasn't → any. */
export function stepFilter(f: HasFilter, key: HasKey): HasFilter {
  const next = { ...f };
  if (f[key] === undefined) next[key] = true;
  else if (f[key] === true) next[key] = false;
  else delete next[key];
  return next;
}

/** At most this many people in one group email, so it goes within one request and doesn't read as a mass mailing. */
export const GROUP_EMAIL_MAX = 150;

/** Who a group email goes to: those with an address who haven't unsubscribed, up to the limit; and who is left out. */
export function groupRecipients<P extends { id: string; email: string; unsubscribed: boolean }>(people: readonly P[]) {
  const reachable = people.filter((p) => p.email && !p.unsubscribed);
  return {
    to: reachable.slice(0, GROUP_EMAIL_MAX),
    noEmail: people.filter((p) => !p.email).length,
    unsubscribed: people.filter((p) => p.email && p.unsubscribed).length,
    over: Math.max(0, reachable.length - GROUP_EMAIL_MAX),
  };
}

/** A group email as typed: a subject and words, each within bounds; or why it can't go. */
export function cleanGroupEmail(raw: unknown): { ok: true; subject: string; body: string; ids: string[] } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const subject = typeof r.subject === "string" ? r.subject.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const body = typeof r.body === "string" ? r.body.trim().slice(0, 10_000) : "";
  const ids = [
    ...new Set((Array.isArray(r.ids) ? r.ids : []).filter((x): x is string => typeof x === "string" && /^cus_[a-f0-9]{8,64}$/.test(x))),
  ];
  if (!subject) return { ok: false, message: "Give it a subject." };
  if (!body) return { ok: false, message: "Write the email first." };
  if (!ids.length) return { ok: false, message: "Nobody is chosen to send it to." };
  if (ids.length > GROUP_EMAIL_MAX) return { ok: false, message: `Up to ${GROUP_EMAIL_MAX} people in one email.` };
  return { ok: true, subject, body, ids };
}

/** The words with {firstName} filled in ("there" when there is no first name). */
export const fillFirstName = (text: string, firstName: string) => text.replace(/\{firstName\}/g, firstName.trim() || "there");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One person's copy of a group email: the business's words to them, and a link of their own to stop group emails. */
export function groupEmail(input: { business: string; subject: string; body: string; firstName: string; unsubscribe: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const words = fillFirstName(input.body, input.firstName);
  const foot = `Sent by ${input.business} using RENUABL. To stop these emails: ${input.unsubscribe}`;
  return {
    subject: fillFirstName(input.subject, input.firstName),
    text: `${words}\n\n--\n${foot}`,
    html: `<div style="font:15px/1.6 Arial,sans-serif;color:#111">${esc(words).replace(/\n/g, "<br>")}<p style="margin-top:28px;font-size:12px;color:#777">Sent by ${esc(input.business)} using RENUABL. <a href="${esc(input.unsubscribe)}" style="color:#777">Stop these emails</a></p></div>`,
  };
}

/** An unsubscribe link's token: 40 lower-case hex. */
export const isUnsubToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{40}$/.test(t);
