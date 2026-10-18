/**
 * The message that goes with a proposal when the business sends it: a few
 * ready-written drafts to start from, filled in with the customer's first
 * name, the business's name and how long the price stands. The draft is
 * only a starting point: whoever sends it can change every word before it
 * goes into the job's chat (and, when the business has it on, the customer's
 * email with the link).
 *
 * Also what the customer's page makes of the conversation: the business's
 * latest message, shown at the top of the proposal as its greeting, and how
 * many of the business's messages have come since the customer last wrote.
 *
 * Wording rules: no figure, promise or claim the proposal itself doesn't
 * carry (no savings, no "guaranteed", no dates of installation), and never a
 * person's name: the customer sees every line as from "<Business> team".
 */
import type { PublicLine } from "./chat";

export type SendTemplateId = "hello" | "short" | "after-visit" | "updated";

export interface SendTemplate {
  id: SendTemplateId;
  /** What the choice is called on the business's screen. */
  name: string;
  text: string;
}

/** What a draft is filled in with. */
export interface SendFill {
  /** The customer's first name. */
  first: string;
  business: string;
  /** "31 October 2026": the day the price stands until. */
  until: string;
}

/** The drafts, in the order they are offered. `{first}`, `{business}` and `{until}` are filled in. */
export const SEND_TEMPLATES: readonly SendTemplate[] = [
  {
    id: "hello",
    name: "Friendly hello",
    text:
      "Hi {first},\n\n" +
      "Thanks for the chance to look at your home. Your solar proposal is ready: it shows the system we've designed for your roof " +
      "and what it costs.\n\n" +
      "Have a read, and ask us anything right here. The price stands until {until}.\n\n" +
      "The {business} team",
  },
  {
    id: "short",
    name: "Short and simple",
    text: "Hi {first}, your proposal from {business} is ready. Any questions, just write to us here. The price stands until {until}.",
  },
  {
    id: "after-visit",
    name: "After our visit or call",
    text:
      "Hi {first},\n\n" +
      "Great to talk with you. As promised, here's your proposal, designed around what we discussed.\n\n" +
      "If anything should change (where the panels go, adding a battery, the timing), write to us here and we'll update it. " +
      "The price stands until {until}.\n\n" +
      "The {business} team",
  },
  {
    id: "updated",
    name: "Updated proposal",
    text:
      "Hi {first},\n\n" +
      "We've updated your proposal with the changes we talked about. The latest version is the one at this link.\n\n" +
      "Let us know what you think, here in the chat. The price stands until {until}.\n\n" +
      "The {business} team",
  },
];

/** A draft with its blanks filled in. A blank with nothing to fill it reads naturally ("Hi there", "us"). */
export function fillTemplate(id: SendTemplateId, fill: SendFill): string {
  const template = SEND_TEMPLATES.find((t) => t.id === id) ?? SEND_TEMPLATES[0];
  const first = fill.first.trim() || "there";
  const business = fill.business.trim() || "us";
  return template.text
    .replaceAll("{first}", first)
    .replaceAll("{business}", business)
    .replaceAll("{until}", fill.until.trim() || "the date on the proposal")
    .replaceAll("The us team", "The team");
}

/** The draft offered first: "Updated proposal" when the customer has already had one, else the friendly hello. */
export function firstTemplate(sentBefore: boolean): SendTemplateId {
  return sentBefore ? "updated" : "hello";
}

/** The business's latest message: shown at the top of the customer's proposal as its greeting. Null before the business has written. */
export function greetingOf(lines: readonly PublicLine[]): PublicLine | null {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].from === "business") return lines[i];
  return null;
}

/** How many of the business's messages have come since the customer last wrote: the count on the customer's chat button. */
export function newFromBusiness(lines: readonly Pick<PublicLine, "from">[]): number {
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i].from === "business"; i--) n++;
  return n;
}

/** How long a pause is before the next message is shown under its own time, as a phone's messages app does. */
export const PAUSE_MINUTES = 60;

/** Which messages are shown under their time: the first, and any that comes after a pause. */
export function timeBreaks(lines: readonly Pick<PublicLine, "at">[], pauseMinutes = PAUSE_MINUTES): Set<number> {
  const breaks = new Set<number>();
  lines.forEach((line, i) => {
    if (i === 0 || Date.parse(line.at) - Date.parse(lines[i - 1].at) > pauseMinutes * 60_000) breaks.add(i);
  });
  return breaks;
}
