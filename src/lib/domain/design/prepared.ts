/**
 * Ready for you (1 Nov 2026, Martin: "Sol should take work off users in a way that delights them"). Sol prepares work
 * before anyone asks, and leaves it where the member will see it, each a press away from done: Send, Apply, or Not
 * now. He never sends anything himself: the member's press does. Two kinds so far:
 *
 * - a proposal's follow-up, drafted when it falls due (2, 7 and 14 days after sending, `FOLLOW_UP_DAYS`), written for
 *   where the deal stands: opened or not, the customer's last word, which follow-up it is;
 * - a call's recap email, drafted with the call's write-up (call-notes.ts) and put here when the write-up is applied.
 *
 * Each says what Sol based it on, so it can be checked before it goes. Pure: no I/O.
 */
import { marketDateTime, todayInMarket } from "../market";
import type { ISODate } from "../types";
import { INTENDED_FIELDS, type IntendedField, type IntendedSystem } from "./call-notes";
import type { DetailKey } from "./crm";
import { FOLLOW_UP_WORDS } from "./proposal-lists";
import { nextWorkingDay } from "./today-pad";

export type PreparedKind = "follow-up" | "recap";
/** Preparing while Sol writes it; ready to send; then sent or put aside; stale once the reason for it has gone. */
export type PreparedStatus = "preparing" | "ready" | "sent" | "dismissed" | "stale";

export interface PreparedItem {
  id: string;
  kind: PreparedKind;
  jobId: string;
  customerId: string;
  customer: string;
  /** The deal's title, as on the board. */
  title: string;
  /** Why it is here, in a line: "Second follow-up due · sent 7 days ago". */
  why: string;
  /** Where it goes: the customer's email, or "" when they have none. */
  to: string;
  subject: string;
  body: string;
  /** What Sol based it on, one short line each, so it can be checked. */
  basis: string[];
  /** The follow-up day it is for (2, 7 or 14); 0 for a recap. */
  day: number;
  /** Written by Sol (Claude), or from the plain wording when Claude wasn't there. */
  by: "sol" | "plain";
  status: PreparedStatus;
  createdAt: string;
}

/** Each follow-up once: a newer version of the proposal, or the next follow-up day, is a new one. */
export const followUpKey = (jobId: string, version: number, day: number) => `follow-up:${jobId}:${version}:${day}`;
/** A recap belongs to the call it came from. */
export const recapKey = (jobId: string, at: string) => `recap:${jobId}:${at}`;

/** How many new drafts are started at most when the tray is read, so a busy morning doesn't run up a bill at once. */
export const MAX_NEW_AT_ONCE = 3;
/** Drafts still preparing after this long are written again in the plain words, so nothing waits for ever. */
export const PREPARING_MINUTES = 3;

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// ---------------------------------------------------------------------------
// A follow-up
// ---------------------------------------------------------------------------

/** What Sol knows when he drafts a follow-up: only what the business's own record says. */
export interface FollowUpFacts {
  business: string;
  customer: string;
  title: string;
  /** 1, 2 or 3. */
  step: number;
  /** Days since it was sent. */
  age: number;
  /** Whether the customer has opened the proposal's link. */
  opened: boolean;
  /** How many systems it offers. */
  options: number;
  /** An indicative proposal, sent before the site visit. */
  indicative: boolean;
  /** The customer's last words in the proposal's chat, if they have written. */
  lastWord: string | null;
}

/** The line under a follow-up in the tray: why it is there. */
export function followUpWhy(f: Pick<FollowUpFacts, "step" | "age" | "opened">): string {
  const sent = f.age === 1 ? "yesterday" : `${f.age} days ago`;
  return `${FOLLOW_UP_WORDS[f.step - 1]} follow-up due · sent ${sent} · ${f.opened ? "opened" : "not opened yet"}`;
}

/** What Sol based a follow-up on, as the tray shows it. */
export function followUpBasis(f: FollowUpFacts): string[] {
  return [
    `${FOLLOW_UP_WORDS[f.step - 1]} follow-up, ${f.age} days after the proposal went out`,
    f.opened ? "They've opened the proposal" : "They haven't opened the proposal yet",
    f.options > 1 ? `It offers ${f.options} systems to choose from` : "",
    f.indicative ? "It's an indicative proposal, before the site visit" : "",
    f.lastWord ? `Their last message: "${clip(f.lastWord, 90)}"` : "They haven't written in the chat",
  ].filter(Boolean);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The words a follow-up is signed with: the business, never a person Sol can't vouch for. */
export const signOff = (business: string) => `Kind regards,\nThe ${business} team`;

/** The link line every follow-up ends with, so the customer can open their proposal in one press. */
export const proposalLine = (url: string) => `You can open your proposal here: ${url}`;

/** The email as it goes: Sol's words, then the link to their proposal, then the sign-off. */
export function composeFollowUp(body: string, business: string, url: string | null): string {
  return [body.trim(), url ? proposalLine(url) : "", signOff(business)].filter(Boolean).join("\n\n");
}

/** The follow-up in plain words, when Claude isn't there: one for each step, opened or not. No figure or promise. */
export function plainFollowUp(f: FollowUpFacts): { subject: string; body: string } {
  const hi = f.customer ? `Hi ${firstNameOf(f.customer)},` : "Hi,";
  const what = f.indicative ? "the indicative proposal" : "your proposal";
  const lines =
    f.step === 1
      ? f.opened
        ? [
            `Thanks for taking a look at ${what}. Did anything come up that we can answer?`,
            "Happy to talk it through on a quick call whenever suits you.",
          ]
        : [`Just checking ${what} came through: it can end up in a busy inbox.`, "Any questions at all, reply here or give us a call."]
      : f.step === 2
        ? [
            `I wanted to follow up on ${what} we sent last week.`,
            f.options > 1
              ? "If it helps to compare the systems side by side, we're glad to walk you through them."
              : "If anything in it isn't clear, we're glad to walk you through it.",
          ]
        : [
            `We haven't heard back about ${what}, so I didn't want to keep filling your inbox.`,
            "If the timing isn't right, no problem at all: just let us know and we'll check in later.",
          ];
  return { subject: f.step === 3 ? `Should we keep your proposal open?` : `Following up on ${what}`, body: [hi, "", ...lines].join("\n") };
}

export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: { subject: { type: "string" }, body: { type: "string" } },
} as const;

export function followUpPrompt(f: FollowUpFacts): string {
  return [
    `You are Sol, the assistant at ${f.business || "a solar business"} (solar panels, batteries and EV chargers in Australia). Draft a follow-up email to ${f.customer || "a customer"} about the proposal they were sent ("${f.title}"). A person at the business will read it, change it if they like, and send it themselves.`,
    "What the business's record says:",
    ...followUpBasis(f).map((l) => `- ${l}`),
    "",
    "How to write it:",
    "- Australian English, warm and plain, like a person who knows them, not a marketing email. About 60 words, a little more only when answering what they asked; every paragraph one sentence.",
    `- Start "Hi ${firstNameOf(f.customer) || "there"},". No sign-off and no link: both are added after your words.`,
    // The shape a follow-up takes (from Primero's, 5 Nov 2026, where Martin rewrote one this way).
    "- Anything they asked comes first. Otherwise open on the proposal they have, then a sentence each: what did they think, would they change anything, would a quick call help. No recap of the proposal and no explaining how solar works.",
    "- One clear, easy next step, ending on one question they can answer in a line.",
    '- Never "no rush", "no pressure", "take your time" or the like, and nothing that reads as a deadline.',
    "- The record isn't the whole story: refer to past conversations lightly, never imply we didn't follow up, and never point out anything in our records that doesn't match.",
    f.step === 1 ? "- This is the first follow-up: light, helpful." : "",
    f.step === 2
      ? "- This is the second follow-up: open differently from the first, and offer to walk them through it or answer what's holding them back."
      : "",
    f.step === 3
      ? "- This is the last follow-up: open differently again, close the loop kindly, make it easy to say not now, without guilt."
      : "",
    "- Never say or hint that you know whether they opened it: use it only to choose what to say (not opened: it may have got buried; opened: questions they may have).",
    "- If they wrote in the chat, answer the spirit of it briefly or say the team will come back on it; never make up an answer.",
    "- Never mention a price, a figure, a saving, a discount, a date, a rebate or a product, and never promise anything. Never invent facts about their home or the system.",
    "- Never name anyone at the business.",
    "Return the subject (under 60 characters) and the body.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** A draft as Claude sent it, kept to its shape and lengths; null when it is empty. */
export function cleanDraft(raw: unknown): { subject: string; body: string } | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const subject = typeof r.subject === "string" ? r.subject.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  const body = typeof r.body === "string" ? r.body.replace(/\r/g, "").trim().slice(0, 3_000) : "";
  return subject && body ? { subject, body } : null;
}

/** An edit the member made before sending, kept within an email's sizes. */
export function cleanEdit(raw: unknown): { subject: string; body: string } | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const subject = typeof r.subject === "string" ? r.subject.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const body = typeof r.body === "string" ? r.body.replace(/\r/g, "").trim().slice(0, 8_000) : "";
  return subject && body ? { subject, body } : null;
}

// ---------------------------------------------------------------------------
// A call's write-up, applied to the deal
// ---------------------------------------------------------------------------

/** Where each part of the system said on a call goes on the deal (the rest stays in the note). */
export const CALL_TO_DETAIL: Partial<Record<IntendedField, DetailKey>> = {
  solar: "systemSize",
  panels: "panel",
  inverter: "inverter",
  battery: "batteryStorage",
  phase: "phases",
  roof: "roofType",
  storeys: "storeys",
  ev: "evCharger",
  switchboard: "switchboard",
};

export interface DetailChange {
  key: DetailKey;
  label: string;
  value: string;
  /** What the deal holds now ("" when nothing was typed). */
  was: string;
  /** Ticked to start with: only where nothing was typed, so nothing a person wrote is replaced unasked. */
  tick: boolean;
}

/** The deal's fields the call fills in: each with what it holds now, ticked only where it is empty. */
export function callChanges(system: IntendedSystem, details: Readonly<Record<string, string>>): DetailChange[] {
  return INTENDED_FIELDS.flatMap(([field, label]) => {
    const key = CALL_TO_DETAIL[field];
    const value = system[field]?.trim().slice(0, 120) ?? "";
    if (!key || !value) return [];
    const was = details[key]?.trim() ?? "";
    if (was.toLowerCase() === value.toLowerCase()) return [];
    return [{ key, label, value, was, tick: !was }];
  });
}

/** Only the call's own fields, as the member ticked them: anything else sent is dropped. */
export function cleanCallDetails(raw: unknown): Partial<Record<DetailKey, string>> {
  const allowed = new Set(Object.values(CALL_TO_DETAIL));
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kept: Partial<Record<DetailKey, string>> = {};
  for (const [k, v] of Object.entries(r))
    if (allowed.has(k as DetailKey) && typeof v === "string" && v.trim())
      kept[k as DetailKey] = v.replace(/\s+/g, " ").trim().slice(0, 120);
  return kept;
}

/** The longest a call's follow-up reminder can be set ahead, in working days. */
export const MAX_REMIND_DAYS = 30;

/** 9am on the working day `days` working days from today, in the market's time (weekends and holidays passed over). */
export function remindAt(days: number, now = new Date()): string {
  let day: ISODate = todayInMarket(now);
  for (let i = 0; i < Math.max(1, Math.min(MAX_REMIND_DAYS, Math.round(days))); i++) day = nextWorkingDay(day);
  return marketDateTime(day, 9);
}

/** "Follow up with Olivia: send the quote by Thursday". */
export function callReminder(customer: string, nextStep: string): string {
  const who = firstNameOf(customer) || "the customer";
  return clip(nextStep ? `Follow up with ${who}: ${nextStep.replace(/\.$/, "")}` : `Follow up with ${who} after your call`, 200);
}

/** The recap's sign-off and what it was based on, as the tray shows it. */
export const RECAP_BASIS = ["Written from your call notes", "Only what you said on the call: check any figures"];
