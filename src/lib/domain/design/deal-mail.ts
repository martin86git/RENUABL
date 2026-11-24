/**
 * The customer's emails in the member's own connected mailboxes, shown on the deal's Notes timeline (23 Nov 2026,
 * Martin: "notes should be the timeline. I should see any emails to and from"). Emails sent from the deal are already
 * on its record; these are the rest: the customer's replies and anything sent from Gmail or Outlook directly. They are
 * read each time from the member's own mailboxes and never kept on the deal, so a teammate sees their own.
 */
import { readEmailRecord } from "./deal-email";
import { headerOf, parseFrom, type MailPart } from "./inbox";

export interface DealMail {
  /** The mailbox's own id for the email. */
  id: string;
  /** The member's mailbox it was read from. */
  box: string;
  /** "in" from the customer, "out" to them. */
  way: "in" | "out";
  subject: string;
  /** Gmail's or Outlook's own preview of the words. */
  snippet: string;
  at: string;
  /** Who it was from (a name, else the address). */
  from: string;
}

/** The most emails read from each mailbox for one deal. */
export const DEAL_MAIL_MAX = 25;

/** Gmail's search for every email to, from or copied to the address, sent mail included. */
export const gmailQueryFor = (address: string) => {
  const a = address.trim().toLowerCase().replace(/["\s]/g, "");
  return `(from:${a} OR to:${a} OR cc:${a}) -in:chats -in:spam -in:trash`;
};

/** An address safe to search for: one plain email, nothing that could change the search. */
export const searchableAddress = (raw: string | null | undefined): string | null => {
  const a = (raw ?? "").trim().toLowerCase();
  return /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(a) ? a : null;
};

interface Found {
  id: string;
  box: string;
  snippet?: string;
  internalDate?: string;
  payload?: MailPart;
}

/** Gmail's snippets carry HTML entities (&#39;, &amp;): read back as the characters. */
const unentity = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/^(?:\s*(?:re|fwd?|aw)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The emails as the timeline shows them, newest first: only those really to or from the customer, one of each (the
 * same email in two mailboxes, or sent from the deal and so already on its record within ten minutes, is left out).
 */
export function dealMailFrom(found: readonly Found[], customer: string, record: readonly { text: string; at: string }[]): DealMail[] {
  const who = customer.toLowerCase();
  const sent = record.map((r) => ({ subject: norm(readEmailRecord(r.text).subject), at: Date.parse(r.at) }));
  const seen = new Set<string>();
  const out: DealMail[] = [];
  for (const m of found) {
    if (!m.id || !m.payload) continue;
    const fromHead = headerOf(m.payload, "From");
    const from = parseFrom(fromHead);
    const others = `${headerOf(m.payload, "To")} ${headerOf(m.payload, "Cc")}`.toLowerCase();
    const way = from.email.toLowerCase() === who ? "in" : others.includes(who) ? "out" : null;
    if (!way) continue;
    const at = Number(m.internalDate ?? 0);
    if (!Number.isFinite(at) || at <= 0) continue;
    const subject = headerOf(m.payload, "Subject").trim() || "(no subject)";
    const key = `${way}|${norm(subject)}|${Math.round(at / 60_000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (way === "out" && sent.some((s) => s.subject === norm(subject) && Math.abs(s.at - at) < 10 * 60_000)) continue;
    out.push({
      id: m.id,
      box: m.box,
      way,
      subject,
      snippet: unentity(m.snippet ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300),
      at: new Date(at).toISOString(),
      from: from.name || from.email,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
