/**
 * Emailing a customer from their deal (the deal's Email box): a few
 * ready-written starts the member changes as they like, filled in with the
 * deal's own words, and the email itself, built on the server from what the
 * member wrote. It goes from RENUABL's sender in the business's name, with
 * replies to the member who wrote it, and is written on the deal's record.
 * Plain words only: nothing of the proposal's price or the bank details is
 * added by us. Pure, tested.
 */

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

export type CleanDealEmail = { ok: true; to: string; subject: string; body: string } | { ok: false; message: string };

/** What the browser sent, as an email to send: one address, a subject and the words, in range. */
export function cleanDealEmail(raw: unknown): CleanDealEmail {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const to = typeof r.to === "string" ? r.to.trim() : "";
  if (!EMAIL.test(to)) return { ok: false, message: "Add the customer's email address." };
  const subject = typeof r.subject === "string" ? r.subject.replace(/[\r\n]+/g, " ").trim() : "";
  if (!subject) return { ok: false, message: "Add a subject." };
  if (subject.length > MAX_SUBJECT) return { ok: false, message: `Keep the subject under ${MAX_SUBJECT} characters.` };
  const body = typeof r.body === "string" ? r.body.replace(/\r/g, "").trim() : "";
  if (!body) return { ok: false, message: "Write the email." };
  if (body.length > MAX_BODY) return { ok: false, message: `Keep the email under ${MAX_BODY.toLocaleString("en-AU")} characters.` };
  return { ok: true, to, subject, body };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email as sent: the member's words, as they wrote them, and a line saying replies reach the business. */
export function dealEmail(input: { business: string; subject: string; body: string }): { subject: string; text: string; html: string } {
  const foot = `Sent by ${input.business} using RENUABL. Reply to this email to reach ${input.business}.`;
  return {
    subject: input.subject,
    text: `${input.body}\n\n--\n${foot}`,
    html: `<div style="font:14px/1.6 Arial,sans-serif;color:#111">${esc(input.body)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("\n")}<p style="margin-top:24px;color:#888;font-size:12px">${esc(foot)}</p></div>`,
  };
}

/** How the email is written on the deal's record. */
export const emailRecord = (to: string, subject: string, body: string) => `Email to ${to}: ${subject}\n\n${body}`;
