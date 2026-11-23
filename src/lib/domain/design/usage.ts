/**
 * A business's usage in one place, and the owner told as it goes (23 Nov 2026, Martin, from instant.one's "You have
 * used 50% of your monthly send cap" email and its plan page, and Grok's Usage & Billing: "its ideal if we do the same
 * that goes out to the admin email… we need usage locatable for the admin"). Pure, tested (`usage.test.ts`).
 *
 * **Meters** are the month's allowances a business has: Sol credits included with its users (sol-credits.ts), and with
 * Calls & Texts its free minutes and texts (voice-usage.ts). A meter with no allowance (no plan, no add-on, RENUABL's own
 * business) isn't shown or emailed. The month is the market's calendar month, so each starts again on the 1st.
 *
 * **Notices**: the owner is emailed once a month a meter as it passes 50%, 80% and 100% of its allowance
 * (`NOTICE_STEPS`), only the highest step passed (a jump from 40% to 90% sends one email, the 80%), each claimed once.
 * They say what is used, that nothing is owed by the allowance itself, and exactly what happens beyond it.
 */
import { LAUNCH_MARKET } from "../market";
import { SOL_USE_WORDS, type SolUse } from "./sol-credits";
import { VOICE_FREE, VOICE_PRICES } from "./voice-usage";

export const METER_KEYS = ["sol", "minutes", "texts"] as const;
export type MeterKey = (typeof METER_KEYS)[number];

export const METER_WORDS: Record<MeterKey, { label: string; inText: string; units: string }> = {
  sol: { label: "Sol credits", inText: "Sol credits", units: "credits" },
  minutes: { label: "Voice agent minutes", inText: "free voice agent minutes", units: "minutes" },
  texts: { label: "Texts", inText: "free texts", units: "texts" },
};

export interface Meter {
  key: MeterKey;
  used: number;
  /** This month's allowance. */
  included: number;
}

/** The shares of an allowance at which the owner is emailed. */
export const NOTICE_STEPS = [50, 80, 100] as const;
export type NoticeStep = (typeof NOTICE_STEPS)[number];

/** How much of an allowance is used, as a whole percentage (can pass 100). 0 with no allowance. */
export const percentUsed = (m: Pick<Meter, "used" | "included">): number =>
  m.included > 0 ? Math.floor((Math.max(0, m.used) / m.included) * 100) : 0;

/** Percent for the screen: a tenth under 10%, so a little use doesn't read 0%; whole numbers above. */
export function percentWords(m: Pick<Meter, "used" | "included">): string {
  if (m.included <= 0) return "–";
  const p = (Math.max(0, m.used) / m.included) * 100;
  if (p > 0 && p < 10) return `${(Math.floor(p * 10) / 10).toLocaleString("en-AU")}%`;
  return `${Math.floor(p)}%`;
}

/** The notice due for a meter: the highest step passed and not yet sent, else null. Never one for no allowance. */
export function noticeDue(m: Meter, sent: readonly number[]): NoticeStep | null {
  if (m.included <= 0) return null;
  const p = percentUsed(m);
  const passed = NOTICE_STEPS.filter((s) => p >= s);
  const top = passed[passed.length - 1];
  if (top === undefined) return null;
  // A step already sent, or a higher one, means this one is old news.
  if (sent.some((s) => s >= top)) return null;
  return top;
}

/** The last day of a month (YYYY-MM) as "30 November 2026", and how many days are left in it from a day (YYYY-MM-DD). */
export function periodEnd(month: string): { iso: string; words: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0));
  const iso = last.toISOString().slice(0, 10);
  return {
    iso,
    words: last.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export function daysLeft(today: string, month: string): number {
  const end = Date.parse(`${periodEnd(month).iso}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round((end - now) / 86_400_000) + 1);
}

/** Every day of a month as YYYY-MM-DD, for the chart's axis. */
export function daysOf(month: string): string[] {
  const end = Number(periodEnd(month).iso.slice(8));
  return Array.from({ length: end }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const cents = (c: number) => (c % 100 === 0 ? `$${c / 100}` : `$${(c / 100).toFixed(2)}`);
const each = (c: number) => (c < 100 ? `${c}c` : cents(c));

/**
 * What happens once a meter's allowance is used, in the owner's words. `solStops`: running out stops Sol (billing
 * enforced); otherwise he goes on and it is only counted. `capCents`: Calls & Texts' spending cap.
 */
export function beyondWords(key: MeterKey, given: { solStops: boolean; capCents: number }): string {
  if (key === "sol")
    return given.solStops
      ? "Once this month's credits are used, Sol answers from credits you've bought, which never expire. With none bought he stops answering until the 1st, unless a top-up is switched on in Billing. Nothing is charged unless you buy a pack."
      : "Once this month's credits are used, Sol answers from credits you've bought, which never expire. Nothing is charged unless you buy a pack.";
  const price = key === "minutes" ? `${each(VOICE_PRICES.minuteCents)} a minute` : `${each(VOICE_PRICES.textCents)} a text`;
  const cap =
    given.capCents > 0
      ? `Your calls and texts don't stop: beyond the free allowance each is ${price}, including GST, added to your next bill, up to your spending cap of ${cents(given.capCents)} a month.`
      : `Your spending cap is $0, so once the free allowance is used your agents ${key === "minutes" ? "start no new calls" : "send no texts"} until the 1st. Calls coming in are still answered.`;
  return `Nothing is charged while you are within the free allowance. ${cap}`;
}

export interface NoticeGiven {
  business: string;
  step: NoticeStep;
  /** The meter that passed the step. */
  key: MeterKey;
  /** Every meter the business has this month, shown together. */
  meters: Meter[];
  month: string;
  solStops: boolean;
  capCents: number;
  /** The Usage page, else null when the site address isn't set. */
  link: string | null;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The owner's email for a step passed: subject, plain text and HTML. Built on the server from figures only. */
export function usageNoticeEmail(g: NoticeGiven): { subject: string; text: string; html: string } {
  const w = METER_WORDS[g.key];
  const end = periodEnd(g.month).words;
  const headline = g.step >= 100 ? `You've used all of this month's ${w.inText}` : `You've used ${g.step}% of this month's ${w.inText}`;
  const intro =
    g.step >= 100
      ? `${g.business} has used this month's included ${w.units}. They start again on the 1st.`
      : `${g.business} has used ${g.step === 50 ? "half" : `${g.step}%`} of this month's included ${w.units}. Nothing is owed. This is a heads-up so the rest of the month holds no surprises.`;
  const beyond = beyondWords(g.key, g);
  const rows = g.meters.map((m) => ({
    label: METER_WORDS[m.key].label,
    pct: percentWords(m),
    of: `${m.used.toLocaleString("en-AU")} of ${m.included.toLocaleString("en-AU")} ${METER_WORDS[m.key].units}`,
    share: Math.min(100, (Math.max(0, m.used) / Math.max(1, m.included)) * 100),
    lit: m.key === g.key,
  }));
  const footer = `This is a notice about ${g.business}'s RENUABL account, sent to its owner. It isn't a marketing email.`;

  const text = [
    headline,
    `Hi,\n\n${intro}`,
    `Usage for the month ending ${end}:\n${rows.map((r) => `${r.label}: ${r.pct} (${r.of})`).join("\n")}`,
    `What happens beyond the allowance\n${beyond}`,
    g.link ? `See your usage: ${g.link}` : "",
    footer,
  ]
    .filter(Boolean)
    .join("\n\n");

  const cells = rows
    .map(
      (r) => `<td style="padding:16px 20px;vertical-align:top;width:${Math.floor(100 / rows.length)}%">
  <div style="font-size:13px;font-weight:600;color:#1d1d1f">${esc(r.label)}</div>
  <div style="font-size:30px;font-weight:600;color:#1d1d1f;line-height:1.2;margin-top:6px">${esc(r.pct)}</div>
  <div style="font-size:12px;color:#6e6e73;margin-top:2px">${esc(r.of)}</div>
  <div style="height:6px;background:#e3e3e8;border-radius:3px;margin-top:12px"><div style="height:6px;width:${r.share.toFixed(1)}%;background:${r.lit ? "#ff5a1f" : "#3a3d43"};border-radius:3px"></div></div>
</td>`,
    )
    .join("");
  const button = g.link
    ? `<a href="${esc(g.link)}" style="display:block;background:#3a3d43;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px;border-radius:10px;margin:24px 0 8px">View my usage</a>
<p style="font-size:12px;color:#6e6e73;margin:0">If the button doesn't work, copy this into your browser: <a href="${esc(g.link)}" style="color:#3a3d43">${esc(g.link)}</a></p>`
    : "";
  const html = `<div style="background:#f4f4f6;padding:24px 12px;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e3e3e8;border-radius:14px;padding:32px 28px">
<div style="font-size:13px;letter-spacing:0.3em;font-weight:600;color:#1d1d1f">RENUABL</div>
<h1 style="font-size:24px;line-height:1.25;color:#1d1d1f;margin:24px 0 16px">${esc(headline)}</h1>
<p style="font-size:15px;line-height:1.6;color:#3a3d43;margin:0 0 8px">Hi,</p>
<p style="font-size:15px;line-height:1.6;color:#3a3d43;margin:0 0 24px">${esc(intro)}</p>
<div style="border:1px solid #e3e3e8;border-radius:10px;overflow:hidden">
<div style="background:#f4f4f6;padding:10px 20px;font-size:13px;color:#3a3d43"><b>Usage for ${esc(g.business)}</b> · month ends ${esc(end)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${cells}</tr></table>
</div>
${button}
<div style="background:#f4f4f6;border-radius:10px;padding:18px 20px;margin-top:24px">
<div style="font-size:16px;font-weight:600;color:#1d1d1f;margin-bottom:6px">What happens beyond the allowance</div>
<p style="font-size:14px;line-height:1.6;color:#3a3d43;margin:0">${esc(beyond)}</p>
</div>
<p style="font-size:12px;line-height:1.6;color:#6e6e73;border-top:1px solid #e3e3e8;padding-top:16px;margin:28px 0 0">${esc(footer)}</p>
</div></div>`;
  return { subject: headline, text, html };
}

/** One day's use of Sol, by what it was for and who asked (the Usage page's chart). */
export interface SolDayRow {
  day: string;
  use: string;
  by: string | null;
  credits: number;
}

/** The most series a chart draws before the rest fold into "Other" (a validated palette has eight). */
export const SERIES_MAX = 7;

export const USE_WORDS = (use: string) => SOL_USE_WORDS[use as SolUse] ?? "Other";

/** Who asked, for the chart: the email's name part, "Sol by himself" for work nobody asked for. */
export const whoWords = (by: string | null) => (by ? by.split("@")[0] : "Sol by himself");

export interface Stack {
  /** Series, largest first; "Other" last when some were folded. */
  series: { key: string; label: string; total: number }[];
  /** For each day of the month, each series' credits. */
  days: { day: string; values: Record<string, number>; total: number }[];
  total: number;
}

/** The month's Sol use stacked by what it was for, or by who asked; the smallest past `SERIES_MAX` fold into Other. */
export function stackSol(rows: readonly SolDayRow[], month: string, by: "use" | "person"): Stack {
  const keyOf = (r: SolDayRow) => (by === "use" ? r.use || "other" : (r.by ?? "").toLowerCase() || "sol");
  const labelOf = (k: string) => (by === "use" ? USE_WORDS(k) : k === "sol" ? whoWords(null) : whoWords(k));
  rows = rows.filter((r) => r.day.startsWith(`${month}-`));
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(keyOf(r), (totals.get(keyOf(r)) ?? 0) + Math.max(0, r.credits));
  const ranked = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const kept = ranked.length > SERIES_MAX + 1 ? ranked.slice(0, SERIES_MAX) : ranked;
  const keptKeys = new Set(kept.map(([k]) => k));
  const folded = ranked.filter(([k]) => !keptKeys.has(k));
  const series = kept.map(([k, total]) => ({ key: k, label: labelOf(k), total }));
  if (folded.length) series.push({ key: "__other", label: "Other", total: folded.reduce((s, [, n]) => s + n, 0) });
  const days = daysOf(month).map((day) => ({ day, values: {} as Record<string, number>, total: 0 }));
  const at = new Map(days.map((d) => [d.day, d]));
  for (const r of rows) {
    const d = at.get(r.day);
    if (!d || r.credits <= 0) continue;
    const k = keptKeys.has(keyOf(r)) ? keyOf(r) : "__other";
    d.values[k] = (d.values[k] ?? 0) + r.credits;
    d.total += r.credits;
  }
  return { series, days, total: series.reduce((s, x) => s + x.total, 0) };
}

/** The free Calls & Texts allowance as meters, when the business has the add-on. */
export const voiceMeters = (u: { minutes: number; texts: number }): Meter[] => [
  { key: "minutes", used: u.minutes, included: VOICE_FREE.minutes },
  { key: "texts", used: u.texts, included: VOICE_FREE.texts },
];

/** The day (YYYY-MM-DD) a moment falls on in the market's time. */
export const marketDay = (at: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
