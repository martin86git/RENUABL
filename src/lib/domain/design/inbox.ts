/**
 * Email: each member's own Gmail inbox (1 Nov 2026, Martin: Primero's copied across, wave 7). Each member connects
 * their own Gmail once, read only; the inbox shows the newest emails set out by day, each matched to the deal of the
 * customer it came from, machines' emails marked Automated and drawn quieter. An opened email reads as sent, with
 * private notes beside it: only the member and anyone they tag see them, and tagging someone shares that one email
 * with them, never the mailbox. Archiving, marking read and replying stay in Gmail or the deal's Email tab. Pure, tested.
 */
import { todayInMarket } from "../market";
import { addDaysISO } from "../scheduling";
import { mondayOf } from "./design-home";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
/** How many of the newest emails the inbox shows. */
export const INBOX_SIZE = 30;
export const NOTE_MAX = 2000;
/** What an email shares when someone is tagged on it: its words, up to this many characters. */
export const SHARED_TEXT_MAX = 8000;

export interface InboxEmail {
  id: string;
  threadId: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  /** ISO time. */
  at: string;
  unread: boolean;
  automated: boolean;
  /** The customer's deal it is matched to, by the sender's address; only one the member may see. */
  deal: { id: string; customer: string } | null;
  /** How many notes are on it. */
  notes: number;
}

/** "Sam Sparks <sam@x.example>" → its name and address; a bare address has its own handle as the name. */
export function parseFrom(header: string): { name: string; email: string } {
  const m = header.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : header).trim().toLowerCase();
  const name = (m?.[1] ?? "").trim() || email.split("@")[0] || email;
  return { name, email };
}

const MACHINE =
  /(^|[._+-])(no-?reply|do-?not-?reply|notifications?|notify|mailer-daemon|postmaster|bounces?|dmarc|alerts?|news(letter)?|updates?|billing|receipts?|support-?bot)([._+-]|@)/i;

/** Whether an address is a machine's (no-reply, notifications, bounces, DMARC reports): such emails are drawn quieter. */
export const isAutomated = (email: string) => MACHINE.test(email.toLowerCase());

/** The day an email falls under, in the market's days: Today, Yesterday, This week, else the month. */
export function dayGroup(at: string, now: Date): string {
  const today = todayInMarket(now);
  const day = todayInMarket(new Date(at));
  if (day === today) return "Today";
  if (day === addDaysISO(today, -1)) return "Yesterday";
  if (day >= mondayOf(today)) return "This week";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const INBOX_FILTERS = [
  { id: "all", label: "All" },
  { id: "customers", label: "Customers" },
  { id: "unread", label: "Unread" },
  { id: "automated", label: "Automated" },
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number]["id"];

/** The emails a filter and a search leave: every word of the search must be in the sender, subject or line. */
export function filterInbox(emails: readonly InboxEmail[], filter: InboxFilter, search = ""): InboxEmail[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return emails.filter((e) => {
    if (filter === "customers" && !e.deal) return false;
    if (filter === "unread" && !e.unread) return false;
    if (filter === "automated" && !e.automated) return false;
    const hay = `${e.from.name} ${e.from.email} ${e.subject} ${e.snippet} ${e.deal?.customer ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** One part of an email as Gmail gives it (`payload`), walked for its words, its HTML and its files. */
export interface MailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: MailPart[];
}

export const headerOf = (part: MailPart, name: string) =>
  part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** The email's text and HTML (still base64url, as Gmail sends them), its files, and the pictures it carries by content id. */
export function partsOf(payload: MailPart): {
  text: string | null;
  html: string | null;
  files: { n: number; name: string; type: string; size: number; attachmentId: string }[];
  inline: { cid: string; type: string; data?: string; attachmentId?: string }[];
} {
  let text: string | null = null;
  let html: string | null = null;
  const files: { n: number; name: string; type: string; size: number; attachmentId: string }[] = [];
  const inline: { cid: string; type: string; data?: string; attachmentId?: string }[] = [];
  const walk = (p: MailPart) => {
    const type = (p.mimeType ?? "").toLowerCase();
    const cid = headerOf(p, "Content-ID").replace(/[<>]/g, "");
    if (p.parts?.length) return p.parts.forEach(walk);
    if (p.filename && p.body?.attachmentId) {
      if (cid && type.startsWith("image/")) inline.push({ cid, type, attachmentId: p.body.attachmentId });
      else
        files.push({
          n: files.length,
          name: p.filename.slice(0, 200),
          type: type || "application/octet-stream",
          size: p.body.size ?? 0,
          attachmentId: p.body.attachmentId,
        });
      return;
    }
    if (cid && type.startsWith("image/") && p.body?.data) return void inline.push({ cid, type, data: p.body.data });
    if (type === "text/html" && html === null && p.body?.data) html = p.body.data;
    else if (type === "text/plain" && text === null && p.body?.data) text = p.body.data;
  };
  walk(payload);
  return { text, html, files, inline };
}

/** An email's HTML with its own pictures put in place (`cid:` → `data:`), and links made to open in a new tab. */
export function withPictures(html: string, pictures: readonly { cid: string; dataUrl: string }[]): string {
  let out = html;
  for (const p of pictures) out = out.split(`cid:${p.cid}`).join(p.dataUrl);
  return `<base target="_blank">${out}`;
}

/** The words of a note on an email, tidied. */
export const cleanEmailNote = (raw: unknown) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .trim()
        .slice(0, NOTE_MAX)
    : "";

/** Who may read the notes on an email: the member whose inbox it is, and anyone they (or another) tagged on it. */
export const mayReadTalk = (talk: { owner: string; shared: readonly string[] }, me: string) =>
  talk.owner === me.toLowerCase() || talk.shared.includes(me.toLowerCase());

/** A Gmail message id: hex. */
export const isMessageId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8,40}$/i.test(v);
