/**
 * Reaching a contact from the phone assistant's window (13 Nov 2026, Martin: open the assistant, search a customer
 * contact, and call or text them). The search is the page search's own (`matches` in find.ts: a number by its digits,
 * else every word in the name, email or address); each contact found carries the deal a call or text is kept on (their
 * newest deal not lost, else their newest), since both are written on a deal's record. A text is plain words, sent to
 * the mobile on the customer's record. Pure, tested.
 */
import { normaliseMobile } from "../contact";
import { matches } from "./find";

export interface ReachCustomer {
  id: string;
  name: string;
  firstName: string;
  phone: string;
  email: string;
  address: string;
}

export interface ReachJob {
  id: string;
  customerId: string;
  title: string;
  stage: string;
  updatedAt: string;
}

export interface ReachContact {
  id: string;
  name: string;
  firstName: string;
  phone: string;
  /** Whether the number is an Australian mobile, so a text can go to it. */
  mobile: boolean;
  /** The deal a call or a text is kept on; null when they have none this person may see. */
  job: { id: string; title: string; stage: string } | null;
}

/** How many contacts the list shows. */
export const REACH_MAX = 8;

/** The deal to keep a call or text on: the newest not lost, else the newest. */
export function dealFor(customerId: string, jobs: readonly ReachJob[]): ReachJob | null {
  const theirs = jobs.filter((j) => j.customerId === customerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return theirs.find((j) => j.stage !== "lost") ?? theirs[0] ?? null;
}

/**
 * The contacts found for what was typed, those with a number first. Nothing typed: the first few with a number, in the
 * order given (the list's own: the latest touched first).
 */
export function reachContacts(customers: readonly ReachCustomer[], jobs: readonly ReachJob[], typed: string): ReachContact[] {
  const q = typed.trim();
  const found = q
    ? customers.filter((c) => matches({ words: [c.name, c.email, c.address], phone: c.phone }, q))
    : customers.filter((c) => c.phone.trim());
  return [...found]
    .sort((a, b) => Number(Boolean(b.phone.trim())) - Number(Boolean(a.phone.trim())))
    .slice(0, REACH_MAX)
    .map((c) => {
      const job = dealFor(c.id, jobs);
      return {
        id: c.id,
        name: c.name,
        firstName: c.firstName || c.name.split(/\s+/)[0] || "",
        phone: c.phone.trim(),
        mobile: normaliseMobile(c.phone) !== null,
        job: job ? { id: job.id, title: job.title, stage: job.stage } : null,
      };
    });
}

/** The most contacts the phone book draws at once (a business's whole list, kept sane). */
export const PHONE_BOOK_MAX = 5000;

export interface PhoneBookSection {
  /** A to Z, or "#" for a name that doesn't start with a letter. */
  letter: string;
  contacts: ReachContact[];
}

const letterOf = (name: string) => {
  const first = name.trim().charAt(0).toLocaleUpperCase("en-AU");
  return /[A-Z]/.test(first) ? first : "#";
};

/**
 * The phone book (23 Nov 2026, Martin: "I should be able to scroll the entire contact list like a phone book"): every
 * contact, or every one matching what was typed, A to Z by name in sections by first letter ("#" last), each with the
 * deal a call or text is kept on. Pure, tested.
 */
export function phoneBook(customers: readonly ReachCustomer[], jobs: readonly ReachJob[], typed: string): PhoneBookSection[] {
  const q = typed.trim();
  const found = (q ? customers.filter((c) => matches({ words: [c.name, c.email, c.address], phone: c.phone }, q)) : customers)
    .filter((c) => c.name.trim() || c.phone.trim())
    .slice()
    .sort((a, b) => {
      const la = letterOf(a.name);
      const lb = letterOf(b.name);
      if (la !== lb) return la === "#" ? 1 : lb === "#" ? -1 : la.localeCompare(lb);
      return a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" });
    })
    .slice(0, PHONE_BOOK_MAX);
  const byCustomer = new Map<string, ReachJob[]>();
  for (const j of jobs) byCustomer.set(j.customerId, [...(byCustomer.get(j.customerId) ?? []), j]);
  const sections: PhoneBookSection[] = [];
  for (const c of found) {
    const job = dealFor(c.id, byCustomer.get(c.id) ?? []);
    const contact: ReachContact = {
      id: c.id,
      name: c.name.trim() || c.phone.trim(),
      firstName: c.firstName || c.name.split(/\s+/)[0] || "",
      phone: c.phone.trim(),
      mobile: normaliseMobile(c.phone) !== null,
      job: job ? { id: job.id, title: job.title, stage: job.stage } : null,
    };
    const letter = letterOf(c.name);
    const last = sections[sections.length - 1];
    if (last?.letter === letter) last.contacts.push(contact);
    else sections.push({ letter, contacts: [contact] });
  }
  return sections;
}

/** The longest text taken: three standard messages' worth. */
export const TEXT_MAX = 480;

export const TEXT_WORDS = {
  empty: "Write the text first.",
  long: `Keep a text under ${TEXT_MAX} characters.`,
  off: "Texts aren't switched on for your business yet.",
  noMobile: "There's no Australian mobile on this customer's record to text.",
  failed: "The text couldn't be sent just now. Try again in a moment.",
  missing: "That deal isn't here.",
  replies: "Replies come back onto this deal, under Deals in team chat.",
} as const;

/** The words of a text as they are sent: trimmed, line ends made plain, no control characters. */
export function cleanText(raw: unknown): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof raw !== "string") return { ok: false, message: TEXT_WORDS.empty };
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { ok: false, message: TEXT_WORDS.empty };
  if (text.length > TEXT_MAX) return { ok: false, message: TEXT_WORDS.long };
  return { ok: true, text };
}

/** How many messages a text goes as: 160 characters in one, 153 each across several (70 and 67 with other alphabets or emoji). */
export function textParts(text: string): number {
  if (!text) return 0;
  const plain = /^[\u0000-\u007f£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§äöñüà¡¿€]*$/.test(text);
  const [one, each] = plain ? [160, 153] : [70, 67];
  return text.length <= one ? 1 : Math.ceil(text.length / each);
}

/** The line kept on the deal's record for a text sent. */
export const textRecord = (to: string, text: string) => `Text sent to ${to}: ${text}`;
