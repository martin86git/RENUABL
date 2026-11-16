/**
 * Sol's suggestions on each deal in Today's Deals list (16 Nov 2026, Martin: "there should be hand off opportunities to
 * Sol here… suggestions from Sol I should be able to click on"; as Primero's, a press has Sol write the email and the
 * draft opens in the feed's place). Read by rule from the deal as the feed already has it: no Sol credit until one is
 * pressed. Pure, tested.
 */
import type { FeedDeal } from "./deal-feed";
import { markHolds } from "./deal-feed";

export type SuggestionKind = "write" | "review";

export interface SolSuggestion {
  kind: SuggestionKind;
  /** The chip's words, short: "Write a follow-up". */
  label: string;
  /** For "write": what Sol is asked to write, as a member would ask it (sent to /write as `ask`). */
  ask?: string;
}

/** At most this many chips under a deal, so the list stays a list. */
export const SUGGESTIONS_MAX = 2;

const first = (name: string) => name.trim().split(/\s+/)[0] || "them";

/**
 * What Sol can take off the member's hands on this deal, most useful first: his own email waiting to be checked, then
 * an email for where the deal stands (a reply to what they last wrote, a first hello, a proposal follow-up, the
 * install day, a check-in). Nothing to write without an email on the record, and nothing while Done or Later holds.
 */
export function solSuggestions(d: FeedDeal, now = new Date()): SolSuggestion[] {
  if (markHolds(d, now)) return [];
  const out: SolSuggestion[] = [];
  if (d.sol) out.push({ kind: "review", label: "Review Sol's email" });
  if (d.canEmail) {
    const name = first(d.customer);
    const wrote = d.events[0]?.kind === "message";
    const touched = d.events.some((e) => e.kind === "call" || e.kind === "email" || e.kind === "reply");
    if (wrote)
      out.push({
        kind: "write",
        label: `Answer ${name}`,
        ask: `Answer what ${name} last wrote to us, warmly and plainly, from what the deal's record says. If something needs the team to check, say we'll come back to them.`,
      });
    else if (d.stage === "lead" && !touched)
      out.push({
        kind: "write",
        label: "Write a first hello",
        ask: `A first hello to ${name}, a new enquiry: thank them for getting in touch, say what happens next (we design their system and send a proposal), and offer a quick call.`,
      });
    else if (d.stage === "proposal")
      out.push({
        kind: "write",
        label: "Write a follow-up",
        ask: `Follow up on the proposal we sent ${name}: ask what they thought, whether anything should change, and offer a quick call to go through it.`,
      });
    else if (d.stage === "won" && !d.installDate)
      out.push({
        kind: "write",
        label: "Ask about install days",
        ask: `Thank ${name} for going ahead, and ask which weekdays suit them for the installation so we can book it in.`,
      });
    else if (d.stage === "lead" || d.stage === "designed")
      out.push({
        kind: "write",
        label: "Write a check-in",
        ask: `A short check-in with ${name}: let them know we're working on their system and ask if they have any questions in the meantime.`,
      });
  }
  return out.slice(0, SUGGESTIONS_MAX);
}
