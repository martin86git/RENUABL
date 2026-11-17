/**
 * Sol's opening on a new lead (18 Nov 2026, Martin: "New lead comes in… Sol immediately starts to prepare you with options
 * on how to tackle the new lead"). Picked from the deals panel, a lead that nobody has been in touch with yet opens as a
 * short conversation under its card: Sol says how he'd start and offers the ways in, each one press:
 *
 * - send their home to confirm: the hello email he has lined up (first-contact.ts), a text with the link to their page, or both;
 * - talk to them first: the member rings, or the business's voice sales agent does;
 * - design first: the roof designed, then the indicative proposal sent by email or text.
 *
 * Pure: who gets the opening, the words, and the text with the link. Nothing here sends anything.
 */
import type { FeedDeal } from "./deal-feed";

/** The kinds of thing on a deal that mean someone from the business has been in touch already. */
const TOUCHES = new Set(["email", "call", "reply", "proposal"]);

/** Whether the lead gets Sol's opening: still a lead (or designed), no proposal out, nobody in touch yet. */
export function opensWithOptions(d: Pick<FeedDeal, "stage" | "proposal" | "events">): boolean {
  if (d.stage !== "lead" && d.stage !== "designed") return false;
  if (d.proposal) return false;
  return !d.events.some((e) => TOUCHES.has(e.kind));
}

export type OpeningPath = "confirm" | "call" | "design";

const first = (name: string) => name.trim().split(/\s+/)[0] || "them";

/** Sol's words, in one place. */
export const OPENING_WORDS = {
  hello: (name: string) => `${first(name)} just came in. Here's how I'd start. Pick one and I'll take it from there.`,
  confirm: {
    title: "Send their home to confirm",
    why: "Their home from above on a page of its own, with one tap to say it's the right one. No price yet.",
  },
  call: {
    title: "Talk to them first",
    why: "A quick call while the enquiry is fresh: you, or your voice agent.",
  },
  design: {
    title: "Design it first, then send it",
    why: "Draw the roof now, then send the indicative proposal by email or text.",
    designed: "The roof is designed: send the indicative proposal by email or text.",
  },
  chose: {
    confirm: "Send their home to confirm.",
    call: "Let's talk to them first.",
    design: "Design it first.",
  } satisfies Record<OpeningPath, string>,
  confirmNext: "Their page is ready. Email them the link, text it, or do both.",
  callNext: (name: string) => `Who rings ${first(name)}?`,
  designNext: "Open the designer. Once it's drawn, the indicative proposal is ready to email or text from the proposal screen.",
  textSent: "Text sent. Want the email with the same link too?",
  noEmail: "No email on file",
  noMobile: "No mobile on file",
  textsOff: "Texts aren't switched on",
  callsOff: "Voice agents aren't switched on",
} as const;

/**
 * The text with the link to their page, the same for everyone but the names and the link. No price, figure or promise.
 * The member's sign-off is added on the server (texts.ts), so it isn't here.
 */
export function helloText(input: { firstName: string; business: string; url: string }): string {
  const name = input.firstName.trim();
  return `Hi${name ? ` ${name}` : ""}, thanks for getting in touch with ${input.business}. Here's your home from above: ${input.url} Tap to tell us if we've found the right home, and ask us anything there.`;
}
