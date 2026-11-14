/**
 * A practice call with the business's phone assistant (14 Nov 2026, Martin: "as part of the test I want to be able to
 * actually talk to him, not for him to give me a one line test and hang up"; and to see it under way with a timer and
 * hang up). The member's own mobile is rung by the assistant, with every rule and coaching note a real call has, and
 * they play the customer: a new lead from the website, or (asked) a customer with a proposal. Its tools aren't
 * connected, so nothing is booked, texted or written on any deal; the assistant says what it would do instead.
 *
 * Kept apart from customers' calls (`design_practice_calls`, the member's own), shown in the same live call window
 * under the id `PRACTICE_ID`.
 */
import type { CallBrief } from "../voice-agent";

/** The live call window's id for a practice call (never a deal's id, which starts job_). */
export const PRACTICE_ID = "practice";

/** A practice call's reference to Vapi's webhook: `pc_` and hex. */
export const PRACTICE_REF = /^pc_[a-f0-9]{8,64}$/;
export const isPracticeRef = (ref: string): boolean => PRACTICE_REF.test(ref);

/** How long a practice call may run: long enough to try out the hard questions. */
export const PRACTICE_SECONDS = 600;

/** An answered call older than this, or one never answered after this, is over for the window. */
export const PRACTICE_STALE_MINUTES = 15;

const plain = (raw: string | null | undefined, max: number) =>
  (raw ?? "")
    .replace(/[^\p{L}\p{M}\p{N} '-]/gu, "")
    .trim()
    .slice(0, max);

/** What the assistant is told about the practice "customer": the member, playing a new lead. */
export function practiceBrief(o: { assistant: string; business: string; memberFirstName: string | null; coaching: string[] }): CallBrief {
  return {
    mode: "lead",
    assistant: o.assistant,
    business: o.business,
    firstName: plain(o.memberFirstName, 30) || null,
    about: ["Looking for: solar and a battery", "Came from: the website"],
    proposal: null,
    asked: false,
    canBook: false,
    canSendLink: false,
    hasEmail: false,
    coaching: o.coaching,
  };
}

/** Put after every rule: what is different on a practice call. */
export function practiceBlock(o: { memberFirstName: string | null; business: string }): string {
  const who = plain(o.memberFirstName, 30) || "someone";
  return `This is a practice call:
${who} from ${plain(o.business, 60) || "the business"}'s own team is trying you out by playing a customer. Treat them exactly as you would a real customer on this call, with every rule above: they want to hear how you sound, how you answer and how you meet their worries.
- Your tools aren't connected on a practice call. Where you would book a time, ask the team to call back or send a link, say plainly what you would do ("I'd book you in for Tuesday at 10 and send you the invite") and carry on. Nothing is booked, sent or written down.
- If they step out of the role and ask you about yourself, how you'd handle something, or for feedback, answer them as their colleague in a sentence or two, then offer to carry on.
- When they say goodbye or that's enough, thank them and end the call.`;
}

/** What the window and the Settings button say once the call is placed. */
export function practicePlacedWords(assistant: string): string {
  return `${assistant || "Your assistant"} is ringing your mobile now. Answer it and talk as a customer would.`;
}
