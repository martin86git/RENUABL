/**
 * Emailing a customer from their deal (the deal's Email box): a few
 * ready-written starts the member changes as they like, filled in with the
 * deal's own words, and the email itself, built on the server from what the
 * member wrote. It goes from RENUABL's sender in the business's name, with
 * replies to the member who wrote it, and is written on the deal's record.
 * Plain words only: nothing of the proposal's price or the bank details is
 * added by us. Pure, tested.
 */

import { messageHtml } from "./email-compose";

export interface DealEmailContext {
  firstName: string;
  lastName: string;
  address: string;
  business: string;
  /** The member writing, as their name or the part of their email before the @. */
  sender: string;
}

export interface DealEmailTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

/** Ready-written starts. No figure, promise or anyone's name but the customer's and the sender's. */
export const DEAL_EMAIL_TEMPLATES: readonly DealEmailTemplate[] = [
  {
    id: "hello",
    label: "Thanks for your enquiry",
    subject: "Your solar enquiry with {business}",
    body: "Hi {first_name},\n\nThanks for getting in touch about solar for {address}. I'll take a look at your roof and put together a design and price for you.\n\nIf you have a recent electricity bill handy, reply with a photo of it and I'll size the system to how you use power.\n\nKind regards,\n{sender}\n{business}",
  },
  {
    id: "follow-up",
    label: "Following up on the proposal",
    subject: "Following up on your proposal",
    body: "Hi {first_name},\n\nI wanted to check in on the proposal for {address}. Do you have any questions, or would you like anything changed?\n\nHappy to go through it on a quick call whenever suits.\n\nKind regards,\n{sender}\n{business}",
  },
  {
    id: "site-visit",
    label: "Booking a site visit",
    subject: "A site visit at {address}",
    body: "Hi {first_name},\n\nBefore we lock in the design, we'd like to have a quick look at the roof and switchboard at {address}. What days suit you over the next week or two?\n\nKind regards,\n{sender}\n{business}",
  },
  {
    id: "install",
    label: "Installation details",
    subject: "Your installation at {address}",
    body: "Hi {first_name},\n\nA note about your installation at {address}. Our installers will arrive in the morning and the work usually takes the day. Please make sure there's clear access to the switchboard and the roof.\n\nIf anything changes, just reply to this email.\n\nKind regards,\n{sender}\n{business}",
  },
];

const TOKENS: Record<string, (c: DealEmailContext) => string> = {
  first_name: (c) => c.firstName,
  last_name: (c) => c.lastName,
  full_name: (c) => [c.firstName, c.lastName].filter(Boolean).join(" "),
  address: (c) => c.address || "your home",
  business: (c) => c.business,
  sender: (c) => c.sender,
};

/** A template's text with its {tokens} filled in; an unknown token is left as it is, so it shows rather than vanishes. */
export function fillTemplate(text: string, ctx: DealEmailContext): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, name: string) => (TOKENS[name] ? TOKENS[name](ctx) : whole));
}

/** "jordan.smith@example.com" → "Jordan". */
export const senderName = (email: string) => {
  const local = email.split("@")[0]?.split(/[._+-]/)[0] ?? "";
  return local ? local[0].toUpperCase() + local.slice(1).toLowerCase() : "";
};

export const MAX_SUBJECT = 200;
export const MAX_BODY = 8000;
const EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;

/** The most addresses copied in on one email (Cc). */
export const MAX_CC = 5;

export type CleanDealEmail = { ok: true; to: string; cc: string[]; subject: string; body: string } | { ok: false; message: string };

/**
 * The addresses to copy in (Cc), as typed in one box ("a@x.com, b@y.com") or sent as a list: each checked, lower
 * case, none twice, never the address it is sent to, at most `MAX_CC`. A wrong one is named, so it can be put right.
 */
export function cleanCc(raw: unknown, to = ""): { ok: true; cc: string[] } | { ok: false; message: string } {
  const typed = Array.isArray(raw) ? raw.filter((a): a is string => typeof a === "string") : typeof raw === "string" ? [raw] : [];
  const cc: string[] = [];
  for (const address of typed.flatMap((t) => t.split(/[\s,;]+/))) {
    const a = address.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!a) continue;
    if (!EMAIL.test(a)) return { ok: false, message: `"${a.slice(0, 80)}" in Cc doesn't look like an email address.` };
    if (a !== to.toLowerCase() && !cc.includes(a)) cc.push(a);
  }
  if (cc.length > MAX_CC) return { ok: false, message: `Copy in at most ${MAX_CC} people.` };
  return { ok: true, cc };
}

/**
 * What the browser sent, as an email to send: one address, anyone copied in, a subject and the words, in range. With
 * `customer` given (an email Sol drafted, sent from his card), the address is the customer's as the server read it,
 * and anything the browser sent as `to` is ignored.
 */
export function cleanDealEmail(raw: unknown, customer?: string): CleanDealEmail {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const to = customer !== undefined ? customer.trim() : typeof r.to === "string" ? r.to.trim() : "";
  if (!EMAIL.test(to))
    return {
      ok: false,
      message: customer !== undefined ? "This customer has no email address on file yet." : "Add the customer's email address.",
    };
  const cc = cleanCc(r.cc, to);
  if (!cc.ok) return cc;
  const subject = typeof r.subject === "string" ? r.subject.replace(/[\r\n]+/g, " ").trim() : "";
  if (!subject) return { ok: false, message: "Add a subject." };
  if (subject.length > MAX_SUBJECT) return { ok: false, message: `Keep the subject under ${MAX_SUBJECT} characters.` };
  const body = typeof r.body === "string" ? r.body.replace(/\r/g, "").trim() : "";
  if (!body) return { ok: false, message: "Write the email." };
  if (body.length > MAX_BODY) return { ok: false, message: `Keep the email under ${MAX_BODY.toLocaleString("en-AU")} characters.` };
  return { ok: true, to, cc: cc.cc, subject, body };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The email as sent: the member's words, as they wrote them (their lists as real lists in the HTML), any pictures
 * under them, and a line saying replies reach the business. `pictures` is built on the server (`picturesHtml`).
 */
export function dealEmail(input: { business: string; subject: string; body: string; pictures?: string; attached?: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const foot = `Sent by ${input.business} using RENUABL. Reply to this email to reach ${input.business}.`;
  return {
    subject: input.subject,
    text: `${input.body}${input.attached ? `\n\n${input.attached}` : ""}\n\n--\n${foot}`,
    html: `<div style="font:14px/1.6 Arial,sans-serif;color:#111">${messageHtml(input.body)}${input.pictures ? `\n${input.pictures}` : ""}<p style="margin-top:24px;color:#888;font-size:12px">${esc(foot)}</p></div>`,
  };
}

/** How the email is written on the deal's record, with what went with it before the words (so a long email can't cut it off). */
export const emailRecord = (to: string, subject: string, body: string, files: readonly string[] = [], cc: readonly string[] = []) =>
  `Email to ${to}${cc.length ? ` (Cc ${cc.join(", ")})` : ""}: ${subject}${files.length ? `\n${ATTACHED_LINE}${files.join(", ")}` : ""}\n\n${body}`;

const ATTACHED_LINE = "Attached (kept in the deal's Attachments): ";

/** An email as the deal's record wrote it, split back into its parts for the deal's list of emails. */
export interface SentEmail {
  to: string;
  cc: string[];
  subject: string;
  /** Files that went with it (kept in the deal's Attachments). */
  files: string[];
  body: string;
}

/**
 * The parts of an email line on a deal's record (8 Nov 2026, Martin: the Email tab lists every email sent from the
 * deal): `emailRecord`'s "Email to … (Cc …): subject", the files line, then the words. Anything not in that shape (an
 * older or hand-logged email) keeps its first line as the subject and the rest as the words.
 */
export function readEmailRecord(text: string): SentEmail {
  const [head = "", ...rest] = text.replace(/\r/g, "").split("\n");
  const m = head.match(/^(?:Group )?[Ee]mail to (\S+?)(?: \(Cc ([^)]*)\))?: (.*)$/);
  let lines = rest;
  let files: string[] = [];
  if (lines[0]?.startsWith(ATTACHED_LINE)) {
    files = lines[0].slice(ATTACHED_LINE.length).split(", ").filter(Boolean);
    lines = lines.slice(1);
  }
  const body = lines.join("\n").trim();
  if (!m) return { to: "", cc: [], subject: head.trim(), files, body };
  return { to: m[1], cc: m[2] ? m[2].split(", ").filter(Boolean) : [], subject: m[3].trim(), files, body };
}
