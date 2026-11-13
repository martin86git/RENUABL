/**
 * Asking a customer by email before the phone assistant rings them (13 Nov 2026, Martin: "send an email pre the call,
 * where the customer clicks yes or no to receiving a call"; for every RENUABL subscriber, not only RENUABL's own deals).
 *
 * The email carries one private link to a page with two buttons. A Yes, with the very words they agreed to and the
 * time, is kept on the deal as their consent, and lines up the call; a No means the assistant never calls about that
 * deal and the team follows up another way. Opening the link answers nothing (a mail app checking links mustn't), only
 * a press does, once.
 *
 * Audio isn't recorded on the assistant's calls (only the words are kept as a transcript), so the consent and the call's
 * opening say the assistant is automated and that notes are kept, never that the call is recorded. A call with no
 * email asked first (an existing customer, someone who rang in) still opens by saying the assistant is automated.
 */

/** Bump whenever the words a customer agrees to change. */
export const CALL_CONSENT_VERSION = "2026-11-13";

/** How long the link takes an answer; after that it says to get in touch instead. */
export const CONSENT_DAYS = 14;

/** A consent link's token: 40 lower-case hex. */
export const isConsentToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{40}$/.test(t);

const plain = (raw: string | null | undefined, max: number) =>
  (raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export interface ConsentNames {
  /** The business, as its brand kit names it. */
  business: string;
  /** Its phone assistant's name ("Charlie"). */
  assistant: string;
  /** The customer's first name, when known. */
  firstName?: string | null;
}

/** The words on the Yes button's page that the customer agrees to. Kept on the deal, word for word, with the answer. */
export function consentWords(n: ConsentNames): string {
  const business = plain(n.business, 60) || "the business";
  const assistant = plain(n.assistant, 30) || "its phone assistant";
  return `Yes, I'd like a call from ${assistant}, ${business}'s automated (AI) phone assistant, about my enquiry. I understand ${assistant} isn't a person and that notes of the call are kept by ${business}.`;
}

/** The email asking whether they'd like the call: who, why, and the one link to answer. */
export function consentEmail(n: ConsentNames & { link: string }): { subject: string; text: string; html: string } {
  const business = plain(n.business, 60) || "us";
  const assistant = plain(n.assistant, 30) || "our phone assistant";
  const hi = plain(n.firstName, 40);
  const lines = [
    `Hi${hi ? ` ${hi}` : ""},`,
    `Thanks for your interest in ${business}. Would you like a quick call to go through your questions?`,
    `The call would be from ${assistant}, our automated (AI) phone assistant. ${assistant} can answer questions about your enquiry and pass anything else to our team.`,
    `Choose Yes or No here: ${n.link}`,
    `If you say no, we won't call. Our team will be in touch another way.`,
    `The ${business} team`,
  ];
  const foot = `Sent by ${business} using RENUABL.`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const para = (s: string) => `<p style="margin:0 0 14px">${esc(s)}</p>`;
  return {
    subject: `Would you like a call from ${business}?`,
    text: `${lines.join("\n\n")}\n\n--\n${foot}`,
    html: `<div style="font:15px/1.6 Arial,sans-serif;color:#111">${para(lines[0])}${para(lines[1])}${para(lines[2])}<p style="margin:22px 0"><a href="${esc(n.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Yes or no to a call</a></p>${para(lines[4])}${para(lines[5])}<p style="margin-top:28px;font-size:12px;color:#777">${esc(foot)}</p></div>`,
  };
}

export type ConsentAnswer = "yes" | "no";
export type ConsentState = "waiting" | ConsentAnswer | "lapsed";

/** Where an ask stands: answered, still open, or past its days. */
export function consentState(o: { answer: ConsentAnswer | null; askedAt: Date }, now: Date): ConsentState {
  if (o.answer) return o.answer;
  return now.getTime() - o.askedAt.getTime() > CONSENT_DAYS * 86_400_000 ? "lapsed" : "waiting";
}

/** Reads a press from the page: only "yes" or "no". */
export function readConsentAnswer(raw: unknown): ConsentAnswer | null {
  return raw === "yes" || raw === "no" ? raw : null;
}

/** Written on the deal when the email goes, and when they answer (the answer with the words agreed to). */
export function consentRecordLine(
  o: { kind: "asked"; assistant: string; email: string } | { kind: ConsentAnswer; assistant: string; words: string },
): string {
  if (o.kind === "asked") return `Asked by email (${o.email}) whether they'd like a call from ${o.assistant}.`;
  if (o.kind === "no") return `Said no to a call from ${o.assistant} (by email). ${o.assistant} won't call about this deal.`;
  return `Said yes to a call from ${o.assistant} (by email). They agreed to: "${o.words}" (consent wording ${CALL_CONSENT_VERSION}).`;
}

/** Why an ask can't go: what the member is told. */
export type AskRefusal = "off" | "missing" | "no-email" | "no-number" | "said-no" | "waiting" | "no-site" | "no-email-service";

export const ASK_REFUSAL_WORDS: Record<AskRefusal, string> = {
  off: "Calls from your phone assistant aren't switched on for your business yet.",
  missing: "That deal isn't here.",
  "no-email": "There's no email on this customer's record to ask them.",
  "no-number": "There's no mobile on this customer's record to call.",
  "said-no": "They said no to a call from your assistant. Follow up another way.",
  waiting: "They've been asked already. The call is lined up as soon as they say yes.",
  "no-site": "Emails can't be sent yet: the site's address isn't set up.",
  "no-email-service": "Emails can't be sent yet: email isn't set up.",
};

/** The member's own question: whether an ask may go, given what is already on the deal. Null when it may. */
export function askRefusal(o: {
  callsOn: boolean;
  email: string | null | undefined;
  mobile: string | null | undefined;
  last: ConsentState | null;
}): AskRefusal | null {
  if (!o.callsOn) return "off";
  if (!o.mobile) return "no-number";
  if (!o.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) return "no-email";
  if (o.last === "no") return "said-no";
  if (o.last === "waiting") return "waiting";
  return null;
}
