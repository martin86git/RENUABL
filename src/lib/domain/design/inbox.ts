/**
 * Email: each member's own Gmail inbox (1 Nov 2026, Martin: Primero's copied across, wave 7). Each member connects
 * their own Gmail once, read only; the inbox shows the newest emails set out by day, each matched to the deal of the
 * customer it came from, machines' emails marked Automated and drawn quieter. An opened email reads as sent, with
 * private notes beside it: only the member and anyone they tag see them, and tagging someone shares that one email
 * with them, never the mailbox. Opening an email marks it read in Gmail, and it can be marked unread again or archived
 * from here, the same in Gmail (5 Nov 2026, Martin); replying stays in Gmail or the deal's Email tab, and nothing is
 * ever sent or deleted. Pure, tested.
 */
import { todayInMarket } from "../market";
import { addDaysISO } from "../scheduling";
import { mondayOf } from "./design-home";

/**
 * Read, and change labels (5 Nov 2026: read, unread, archive). It can't send, and nothing here deletes. Mailboxes
 * connected before asked for read only: they still read, and are connected again to mark read and archive from here.
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const scopes = (scope: string | undefined) => (scope ?? "").split(/\s+/);
/** Whether the scopes Google granted let RENUABL mark read and archive (else the mailbox is read only). */
export const canChangeMail = (scope: string | undefined) => scopes(scope).includes(GMAIL_SCOPE);
/** Whether the scopes Google granted let RENUABL read the mailbox at all. */
export const canReadMail = (scope: string | undefined) => canChangeMail(scope) || scopes(scope).includes(GMAIL_READONLY_SCOPE);

/** What can be done to an email from the inbox: each a change of Gmail's own labels, so Gmail shows the same. */
export const EMAIL_ACTIONS = ["read", "unread", "archive"] as const;
export type EmailAction = (typeof EMAIL_ACTIONS)[number];
export const isEmailAction = (v: unknown): v is EmailAction => EMAIL_ACTIONS.includes(v as EmailAction);

/**
 * Writing a new email from the inbox (8 Nov 2026, Martin): sent through the member's own Gmail, so it comes from their
 * address and sits in their Sent. gmail.modify already allows sending; a mailbox connected read only can't.
 */
export const COMPOSE_LIMITS = { to: 10, cc: 10, subject: 200, body: 20_000 } as const;

export interface ComposedEmail {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

const ADDRESS = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;

/** Addresses typed in one box ("a@x.com, b@y.com") or sent as a list: each checked, lower case, none twice. */
function addressesIn(raw: unknown, label: string, max: number): { ok: true; list: string[] } | { ok: false; message: string } {
  const typed = Array.isArray(raw) ? raw.filter((a): a is string => typeof a === "string") : typeof raw === "string" ? [raw] : [];
  const list: string[] = [];
  for (const piece of typed.flatMap((t) => t.split(/[\s,;]+/))) {
    const a = piece.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!a) continue;
    if (!ADDRESS.test(a)) return { ok: false, message: `"${a.slice(0, 80)}" in ${label} doesn't look like an email address.` };
    if (!list.includes(a)) list.push(a);
  }
  if (list.length > max) return { ok: false, message: `${label} takes at most ${max} addresses.` };
  return { ok: true, list };
}

/** What the browser sent, as an email to send: someone to send it to, a subject or words, and nothing out of range. */
export function cleanCompose(raw: unknown): { ok: true; mail: ComposedEmail } | { ok: false; message: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const to = addressesIn(r.to, "To", COMPOSE_LIMITS.to);
  if (!to.ok) return to;
  if (!to.list.length) return { ok: false, message: "Who is it to? Add an email address." };
  const cc = addressesIn(r.cc, "Cc", COMPOSE_LIMITS.cc);
  if (!cc.ok) return cc;
  // One line, no control characters: nothing typed can add a header.
  const subject = (typeof r.subject === "string" ? r.subject : "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, COMPOSE_LIMITS.subject);
  const body = (typeof r.body === "string" ? r.body : "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trimEnd();
  if (body.length > COMPOSE_LIMITS.body) return { ok: false, message: "That email is too long to send from here." };
  if (!subject && !body.trim()) return { ok: false, message: "Write a subject or a message first." };
  return { ok: true, mail: { to: to.list, cc: cc.list.filter((a) => !to.list.includes(a)), subject, body } };
}

/** A header word that may hold any character (RFC 2047), plain when it is already plain ASCII. */
const headerWord = (text: string) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`);

/** The email as Gmail's send takes it: RFC 2822 text, base64url, plain words in UTF-8. */
export function rawEmail(from: string, mail: ComposedEmail): string {
  const body = Buffer.from(mail.body.replace(/\n/g, "\r\n"), "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n");
  const lines = [
    `From: ${from}`,
    `To: ${mail.to.join(", ")}`,
    ...(mail.cc.length ? [`Cc: ${mail.cc.join(", ")}`] : []),
    `Subject: ${headerWord(mail.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

/** The labels an action adds and takes off (archiving takes it out of the inbox, as Gmail's own Archive does). */
export function labelChange(action: EmailAction): { addLabelIds: string[]; removeLabelIds: string[] } {
  if (action === "unread") return { addLabelIds: ["UNREAD"], removeLabelIds: [] };
  if (action === "archive") return { addLabelIds: [], removeLabelIds: ["INBOX"] };
  return { addLabelIds: [], removeLabelIds: ["UNREAD"] };
}

/** The inbox after an action on one email: read or unread as said, or gone once archived. */
export function afterAction<T extends { id: string; box?: string; unread: boolean }>(
  emails: readonly T[],
  id: string,
  box: string | undefined,
  action: EmailAction,
): T[] {
  const it = (e: T) => e.id === id && (!box || e.box === box);
  if (action === "archive") return emails.filter((e) => !it(e));
  return emails.map((e) => (it(e) ? { ...e, unread: action === "unread" } : e));
}
/** How many of the newest emails the inbox shows. */
export const INBOX_SIZE = 30;
export const NOTE_MAX = 2000;
/** What an email shares when someone is tagged on it: its words, up to this many characters. */
export const SHARED_TEXT_MAX = 8000;
/** How many Gmail mailboxes one person may connect (5 Nov 2026, Martin: one or more, say their own and sales@). */
export const MAX_MAILBOXES = 5;

/** Several mailboxes' newest emails as one inbox: newest first, the first `size` of them. */
export function mergeInboxes<T extends { at: string }>(boxes: readonly (readonly T[])[], size = INBOX_SIZE): T[] {
  return boxes
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, size);
}

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
  /** The connected mailbox it came to (one person may connect several); it is opened from that one. */
  box?: string;
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
export function filterInbox(emails: readonly InboxEmail[], filter: InboxFilter, search = "", box?: string): InboxEmail[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return emails.filter((e) => {
    if (box && e.box !== box) return false;
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
