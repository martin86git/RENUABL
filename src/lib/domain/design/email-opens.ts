/**
 * Whether a customer opened an email sent from their deal (1 Nov 2026, Martin: Primero's email open tracking copied
 * across, wave 5). Each email sent from a deal carries a picture of one see-through pixel at an address of its own
 * (`/api/o/<token>`); when the customer's mail app loads it, the open is put against that email, and the deal's record
 * says "Opened" beside it. An open is a mail app loading the email's pictures: one that blocks pictures never says it
 * was opened, and Apple Mail's privacy protection opens every email on arrival, so "opened" is a guide, not proof that
 * someone read it. Pure, tested.
 */

/** Opens kept an email; and two within a minute are one. */
export const OPENS_EACH = 20;
const SAME_OPEN_MS = 60_000;

/** A pixel's token: 32 lower-case hex. */
export const isOpenToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32}$/.test(t);

/** An email's opens with one more, unless it is the same open as the last (within a minute). Null when nothing changes. */
export function withOpen(opens: readonly string[], now: Date): string[] | null {
  const last = opens.at(-1);
  if (last && now.getTime() - Date.parse(last) < SAME_OPEN_MS) return null;
  return [...opens, now.toISOString()].slice(-OPENS_EACH);
}

export function cleanOpens(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((o): o is string => typeof o === "string" && !Number.isNaN(Date.parse(o)))
    .slice(-OPENS_EACH);
}

/** The pixel, put at the end of an email's HTML. Never carries anything about the customer: only the token. */
export const openPixel = (site: string, token: string) =>
  `<img src="${site.replace(/\/+$/, "")}/api/o/${token}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;

/** The HTML with the pixel added just before it closes, or at the end. */
export function withPixel(html: string, pixel: string): string {
  const at = html.lastIndexOf("</div>");
  return at < 0 ? html + pixel : html.slice(0, at) + pixel + html.slice(at);
}

/** "Opened today at 3:15 pm", "Opened 3 times, last on Tue 4 Nov", or "Not opened yet". */
export function openedWords(opens: readonly string[], timeZone: string, now = new Date()): string {
  if (!opens.length) return "Not opened yet";
  const last = new Date(opens[opens.length - 1]);
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", minute: "2-digit" })
    .format(last)
    .replace(/\s?([ap])m/i, " $1m")
    .toLowerCase();
  const when =
    day(last) === day(now)
      ? `today at ${time}`
      : `on ${new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(last)}`;
  return opens.length === 1 ? `Opened ${when}` : `Opened ${opens.length} times, last ${when}`;
}

/** A see-through 1×1 GIF. */
export const PIXEL_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

/**
 * A deal's emails at a glance, for the mail mark on a pipeline card (5 Nov 2026, Martin: Sol does the reaching out,
 * so the board shows at a glance that an email went and whether it was opened): how many went, when the latest went,
 * and whether that latest one has been opened. Null when none has gone.
 */
export interface MailMark {
  sent: number;
  lastSent: string;
  opened: boolean;
  /** The latest open of the latest email. */
  lastOpened: string | null;
}

export function mailMark(emails: readonly { sentAt: string; opens: readonly string[] }[]): MailMark | null {
  const sent = emails.filter((e) => !Number.isNaN(Date.parse(e.sentAt)));
  if (!sent.length) return null;
  const latest = sent.reduce((a, b) => (Date.parse(b.sentAt) > Date.parse(a.sentAt) ? b : a));
  const opens = [...latest.opens].sort((a, b) => Date.parse(a) - Date.parse(b));
  return { sent: sent.length, lastSent: latest.sentAt, opened: opens.length > 0, lastOpened: opens.at(-1) ?? null };
}

/** The mark in words, for its title: "Email sent today · opened today at 3:15 pm", "3 emails sent, the latest on Tue, 3 Nov · not opened yet". */
export function mailMarkWords(mark: MailMark, timeZone: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const sentAt = new Date(mark.lastSent);
  const yesterday = new Date(now.getTime() - 86_400_000);
  const when =
    day(sentAt) === day(now)
      ? "today"
      : day(sentAt) === day(yesterday)
        ? "yesterday"
        : `on ${new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(sentAt)}`;
  const sent = mark.sent === 1 ? `Email sent ${when}` : `${mark.sent} emails sent, the latest ${when}`;
  const opened = mark.lastOpened ? openedWords([mark.lastOpened], timeZone, now).replace(/^Opened/, "opened") : "not opened yet";
  return `${sent} · ${opened}`;
}
