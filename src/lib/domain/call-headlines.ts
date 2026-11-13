/**
 * What a call came to, and the words for it. A module of its own with nothing imported, so anything may read the
 * headlines without pulling in the phone assistant's whole script (voice-agent.ts re-exports both): design/coaching
 * reads them through design/assistant-deals, and voice-agent reads coaching, which was a circle that broke the build.
 */
export type CallOutcome =
  "booked" | "pencilled" | "callback" | "link-sent" | "no-more-calls" | "transferred" | "talked" | "no-answer" | "voicemail" | "failed";

/**
 * What a call came to, as the first line of its entry on the deal's record (12 Nov 2026, Martin: a booked call didn't
 * read as booked). `readCallLine` reads it back for the timeline.
 */
export const CALL_HEADLINES: Record<CallOutcome, string> = {
  booked: "15-minute call booked",
  pencilled: "Install day pencilled in",
  callback: "Wants a call back from the team",
  "link-sent": "Proposal link sent",
  "no-more-calls": "Asked not to be called again",
  transferred: "Put through to the team",
  talked: "Spoke to them, nothing booked",
  "no-answer": "No answer",
  voicemail: "Left a voicemail",
  failed: "Call didn't connect",
};
