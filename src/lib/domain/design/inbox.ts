/**
 * Email: each member's own Gmail inbox (1 Nov 2026, Martin: Primero's copied across, wave 7). Each member connects
 * their own Gmail once, read only; the inbox shows the newest emails set out by day, each matched to the deal of the
 * customer it came from, machines' emails marked Automated and drawn quieter. An opened email reads as sent, with
 * private notes beside it: only the member and anyone they tag see them, and tagging someone shares that one email
 * with them, never the mailbox. Opening an email marks it read in Gmail, and it can be marked unread again or archived
 * from here, the same in Gmail (5 Nov 2026, Martin). A new email is written here and sent through the member's own Gmail
 * (8 Nov 2026), with pictures, files, links, a text size and Sol's help; replying stays in Gmail or the deal's Email tab,
 * and nothing is ever deleted. Pure, tested.
 */
import { todayInMarket } from "../market";
import { addDaysISO } from "../scheduling";
import { mondayOf } from "./design-home";
import { messageBlocks } from "./email-compose";

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
export const COMPOSE_LIMITS = { to: 10, cc: 10, subject: 200, body: 20_000, instructions: 2_000 } as const;

/** The email's text size (8 Nov 2026, Martin: a way to change it), for the whole email, in pixels in the HTML version. */
export const EMAIL_SIZES = [
  { id: "small", label: "Small", px: 13 },
  { id: "normal", label: "Normal", px: 14 },
  { id: "large", label: "Large", px: 16 },
  { id: "huge", label: "Larger", px: 18 },
] as const;
export type EmailSize = (typeof EMAIL_SIZES)[number]["id"];
const sizeOf = (raw: unknown): EmailSize => (EMAIL_SIZES.some((s) => s.id === raw) ? (raw as EmailSize) : "normal");

export interface ComposedEmail {
  to: string[];
  cc: string[];
  subject: string;
  /** As typed: lists with "• " and "1. ", links as [words](address). */
  body: string;
  size: EmailSize;
}

/**
 * A link's address as typed, made safe to send: "renuabl.com.au" gains https://, an email address becomes mailto:,
 * and only web and mail links are kept (never javascript: or a file). Null when it isn't one.
 */
export function cleanLinkUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url || /\s/.test(url) || url.length > 2000) return null;
  if (ADDRESS.test(url)) url = `mailto:${url}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.protocol === "mailto:") return ADDRESS.test(decodeURIComponent(u.pathname)) ? url : null;
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The words with a link put round the selection ([words](address)); with nothing selected, the address is the words. */
export function withLink(text: string, start: number, end: number, url: string): { text: string; caret: number } {
  const words = text.slice(start, end).replace(/[[\]]/g, "").trim() || url.replace(/^mailto:/, "");
  const link = `[${words}](${url})`;
  return { text: text.slice(0, start) + link + text.slice(end), caret: start + link.length };
}

const LINK = /\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/g;

/** The plain-text version of the words: each link as "words (address)". */
export const plainBody = (body: string) =>
  body.replace(LINK, (_, words: string, url: string) => {
    const safe = cleanLinkUrl(url);
    return safe ? `${words} (${safe.replace(/^mailto:/, "")})` : words;
  });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One line as HTML: escaped, its [words](address) links made real (only safe addresses), the rest left as words. */
function lineHtml(line: string): string {
  let out = "";
  let at = 0;
  for (const m of line.matchAll(LINK)) {
    out += esc(line.slice(at, m.index));
    const url = cleanLinkUrl(m[2]);
    out += url ? `<a href="${esc(url)}" style="color:#1a56db">${esc(m[1])}</a>` : esc(m[1]);
    at = m.index! + m[0].length;
  }
  return out + esc(line.slice(at));
}

/** The words as the email's HTML: paragraphs, real lists and links, at the chosen size, with the pictures under them. */
export function composeHtml(body: string, size: EmailSize, picturesHtml = ""): string {
  const px = EMAIL_SIZES.find((s) => s.id === size)?.px ?? 14;
  const li = (items: string[]) => items.map((i) => `<li style="margin:0 0 4px">${lineHtml(i)}</li>`).join("");
  const blocks = messageBlocks(body)
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 12px">${b.lines.map(lineHtml).join("<br>")}</p>`;
      if (b.kind === "ul") return `<ul style="margin:0 0 12px;padding-left:22px">${li(b.items)}</ul>`;
      return `<ol${b.start !== 1 ? ` start="${b.start}"` : ""} style="margin:0 0 12px;padding-left:24px">${li(b.items)}</ol>`;
    })
    .join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:${px}px;line-height:1.5;color:#1a1a1a">${blocks}${picturesHtml ? `\n${picturesHtml}` : ""}</div>`;
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
export function cleanCompose(raw: unknown, hasFiles = false): { ok: true; mail: ComposedEmail } | { ok: false; message: string } {
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
  if (!subject && !body.trim() && !hasFiles) return { ok: false, message: "Write a subject or a message first." };
  return {
    ok: true,
    mail: { to: to.list, cc: cc.list.filter((a) => !to.list.includes(a)), subject, body, size: sizeOf(r.size) },
  };
}

/** A header word that may hold any character (RFC 2047), plain when it is already plain ASCII. */
const headerWord = (text: string) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`);
/** A file's name in a header: quotes and line breaks taken out, encoded when it isn't plain ASCII. */
const fileWord = (name: string) => headerWord(name.replace(/["\\\r\n]/g, "").slice(0, 150) || "file");
const base64Lines = (bytes: Uint8Array | string) =>
  Buffer.from(bytes)
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n");

/** A file going with a new email: a picture shown inside it (by its content id), or an attachment. */
export interface ComposedFile {
  name: string;
  type: string;
  bytes: Uint8Array;
  /** Set for a picture shown inside the email under the words. */
  contentId?: string;
}

/**
 * The email as Gmail takes it (RFC 2822, as bytes): the words in plain text and HTML (lists, links, the chosen size),
 * pictures inside the email under the words and other files attached. Kept plain text alone when there's nothing more.
 */
export function rawEmail(from: string, mail: ComposedEmail, files: readonly ComposedFile[] = [], picturesHtml = ""): Buffer {
  const bound = (n: string) => `renuabl-${n}-${Buffer.from(`${from}${mail.subject}${files.length}`).toString("hex").slice(0, 16)}`;
  const text = [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(plainBody(mail.body).replace(/\n/g, "\r\n")),
  ].join("\r\n");
  const html = [
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(composeHtml(mail.body, mail.size, picturesHtml)),
  ].join("\r\n");
  const part = (f: ComposedFile) =>
    [
      `Content-Type: ${f.type}; name="${fileWord(f.name)}"`,
      "Content-Transfer-Encoding: base64",
      f.contentId
        ? `Content-Disposition: inline; filename="${fileWord(f.name)}"\r\nContent-ID: <${f.contentId}>`
        : `Content-Disposition: attachment; filename="${fileWord(f.name)}"`,
      "",
      base64Lines(f.bytes),
    ].join("\r\n");
  const multipart = (kind: string, b: string, parts: string[]) =>
    [`Content-Type: multipart/${kind}; boundary="${b}"`, "", ...parts.map((p) => `--${b}\r\n${p}`), `--${b}--`, ""].join("\r\n");
  const pictures = files.filter((f) => f.contentId);
  const attached = files.filter((f) => !f.contentId);
  const words = multipart("alternative", bound("alt"), [text, html]);
  const shown = pictures.length ? multipart("related", bound("rel"), [words, ...pictures.map(part)]) : words;
  const whole = attached.length ? multipart("mixed", bound("mix"), [shown, ...attached.map(part)]) : shown;
  const head = [
    `From: ${from}`,
    `To: ${mail.to.join(", ")}`,
    ...(mail.cc.length ? [`Cc: ${mail.cc.join(", ")}`] : []),
    `Subject: ${headerWord(mail.subject)}`,
    "MIME-Version: 1.0",
  ].join("\r\n");
  return Buffer.from(`${head}\r\n${whole}`, "utf8");
}

/** What Sol is asked to do with an email being written: tidy the words up, or write it from what the member says. */
export type ComposeHelp = "polish" | "write";

/**
 * Sol's instructions for an email being written (8 Nov 2026, Martin: a Polish button, and telling Sol what the email
 * should say). Polishing keeps their meaning and voice and only tidies; writing follows what they asked. Neither adds a
 * figure, price, date, product or promise that isn't already in their words or what they asked.
 */
export function composeHelpPrompt(
  mode: ComposeHelp,
  input: { business: string; to: string[]; subject: string; body: string; instructions: string },
): string {
  const draft = [input.subject && `Subject: ${input.subject}`, input.body && `Words so far:\n${input.body}`].filter(Boolean).join("\n\n");
  const rules = [
    'Australian English, plain and warm, short paragraphs. Keep lists as lines starting with "• " or "1. ", and links as [words](address).',
    "Never add a figure, price, saving, date, product, rebate or promise that isn't in the words or the request. Where something must be checked, say it will be confirmed.",
    "No sign-off name: the sender adds their own. Return the subject and the words.",
  ];
  if (mode === "polish")
    return [
      `You are Sol, the assistant at ${input.business}, a solar business in Australia. Tidy up this email: fix spelling, grammar and punctuation, make it clearer and easier to read, and keep the writer's meaning, voice and every fact. Don't make it longer than it needs to be. Keep the subject unless it is empty or unclear.`,
      ...rules,
      "",
      draft || "(nothing written yet)",
    ].join("\n");
  return [
    `You are Sol, the assistant at ${input.business}, a solar business in Australia. Write an email as the member asks${input.to.length ? `, to ${input.to.join(", ")}` : ""}. Treat their request as what to say, and use their words so far where they fit.`,
    ...rules,
    "",
    `What they want: ${input.instructions}`,
    ...(draft ? ["", draft] : []),
  ].join("\n");
}

/** Sol's answer, tidied: a subject on one line and the words, each in range. */
export function cleanComposeHelp(raw: unknown): { subject: string; body: string } | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const subject =
    typeof r.subject === "string"
      ? r.subject
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .trim()
          .slice(0, COMPOSE_LIMITS.subject)
      : "";
  const body = typeof r.body === "string" ? r.body.replace(/\r\n?/g, "\n").trim().slice(0, COMPOSE_LIMITS.body) : "";
  return body ? { subject, body } : null;
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
