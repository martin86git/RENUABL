/**
 * Calling a customer from the computer (12 Nov 2026, Martin: Call couldn't ring from the computer; "like VoIP", through
 * Twilio). The member talks through the browser's microphone and headset (Twilio's Voice SDK in the page); Twilio rings
 * the customer's mobile from the business's number, so a call back reaches its phone assistant. Both sides are
 * recorded (the customer first hears that the call may be recorded), Twilio turns the recording into words, and Sol
 * writes it up on the deal as the note-taker does, from both sides this time. Pure: no I/O; server/twilio-voice.ts
 * and server/browser-calls.ts do the rest.
 */

/** How long a call ticket (the deal and number a press on Call asked for) lasts before Twilio must use it. */
export const TICKET_SECONDS = 120;
/** How long the browser's Twilio token lasts. */
export const TOKEN_SECONDS = 3600;
/** How long a call may run before Twilio ends it. */
export const MAX_CALL_SECONDS = 3600;

/** What the customer hears as they answer, before the member is put through. */
export function recordingNotice(business: string): string {
  const who = business
    .replace(/[^\p{L}\p{N} &'.,-]/gu, "")
    .trim()
    .slice(0, 60);
  return `Hello, this is a call from ${who || "your solar business"}. This call may be recorded.`;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Twilio's instructions for the call: ring the customer from our number, play the notice to them, record both sides. */
export function dialTwiml(o: {
  callerId: string;
  number: string;
  /** Where Twilio says how the call ended. */
  actionUrl: string;
  /** Where the customer's side is told the call may be recorded; null records nothing. */
  noticeUrl: string | null;
  /** Where Twilio says the recording is ready; null records nothing. */
  recordingUrl: string | null;
}): string {
  const record = o.recordingUrl
    ? ` record="record-from-answer-dual" recordingStatusCallback="${xml(o.recordingUrl)}" recordingStatusCallbackEvent="completed"`
    : "";
  const notice = o.noticeUrl ? ` url="${xml(o.noticeUrl)}"` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Dial callerId="${xml(o.callerId)}" answerOnBridge="true" timeLimit="${MAX_CALL_SECONDS}" action="${xml(o.actionUrl)}"${record}>` +
    `<Number${notice}>${xml(o.number)}</Number></Dial></Response>`
  );
}

/** The notice played to the customer as they answer (Australian English). */
export function noticeTwiml(business: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-AU">${xml(recordingNotice(business))}</Say></Response>`;
}

/** When there is nothing to say, or a call can't be made: Twilio hears this and hangs up. */
export function sayTwiml(words: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-AU">${xml(words)}</Say><Hangup/></Response>`;
}
export const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

/** How a call ended, from Twilio's DialCallStatus. */
export type CallEnd = "answered" | "no-answer" | "busy" | "failed" | "cancelled";
export function callEnd(status: string, seconds: number): CallEnd {
  const s = status.toLowerCase();
  if (s === "completed" || s === "answered") return seconds > 0 ? "answered" : "no-answer";
  if (s === "busy") return "busy";
  if (s === "no-answer") return "no-answer";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  return "failed";
}

/** "4 min 12 s", "38 s". */
export function durationWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

/** The first line of the call's entry on the deal. */
export function browserCallHeadline(end: CallEnd, seconds: number): string {
  if (end === "answered") return `Called from the computer · ${durationWords(seconds)}`;
  if (end === "busy") return "Called from the computer · line busy";
  if (end === "cancelled") return "Called from the computer · hung up before they answered";
  if (end === "failed") return "Called from the computer · the call didn't go through";
  return "Called from the computer · no answer";
}

/** The mark at the end of an entry that has a recording, read by the deal's timeline to offer it (`recordingOf`). */
const RECORDING_MARK = /\n?\[recording:(bc_[0-9a-f]{24})\]\s*$/;
export const recordingLine = (callId: string) => `[recording:${callId}]`;
export function recordingOf(text: string): { callId: string; text: string } | null {
  const m = RECORDING_MARK.exec(text);
  return m ? { callId: m[1], text: text.slice(0, m.index).trimEnd() } : null;
}

/** One sentence of Twilio's transcript. Channel 1 is the member's side (the call they placed), 2 the customer's. VERIFY. */
export interface Sentence {
  channel: number;
  text: string;
  start: number;
}

/** Twilio's sentences, kept to their shape, in order. */
export function cleanSentences(raw: unknown): Sentence[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
    .map((s) => ({
      channel: Number(s.media_channel ?? s.channel ?? 0),
      text: typeof s.transcript === "string" ? s.transcript.replace(/\s+/g, " ").trim() : "",
      start: Number(s.start_time ?? 0) || 0,
    }))
    .filter((s) => s.text)
    .sort((a, b) => a.start - b.start);
}

/** The transcript as Sol reads it: each turn marked as ours or the customer's, runs by one side joined. */
export function dialogue(sentences: readonly Sentence[], customer: string, maxChars = 40_000): string {
  const them = customer.split(" ")[0] || "Customer";
  const turns: { who: string; text: string }[] = [];
  for (const s of sentences) {
    const who = s.channel === 1 ? "Us" : `${them} (customer)`;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text += ` ${s.text}`;
    else turns.push({ who, text: s.text });
  }
  return turns
    .map((t) => `${t.who}: ${t.text}`)
    .join("\n")
    .slice(0, maxChars);
}

/** Words in a transcript, to tell a real conversation from a voicemail greeting. */
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Fewer words than this and there's nothing for Sol to write up. */
export const MIN_WRITE_UP_WORDS = 20;

/** What the entry says when the call was recorded but couldn't be written up. */
export const NOT_WRITTEN = {
  noTranscripts: "Recorded. Turn on Twilio's transcripts to have Sol write calls up.",
  short: "Recorded. Too little was said to write up.",
  late: "Recorded. The transcript wasn't ready in time, so Sol didn't write it up.",
  failed: "Recorded. Sol couldn't write it up just now.",
  noCredits: "Recorded. Sol had no answers left this month to write it up.",
} as const;
