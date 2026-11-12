/**
 * A call's transcript, read back on the deal's timeline (12 Nov 2026, Martin: the transcript must be there to open from
 * the deal's timeline). Two kinds of call leave one: the phone assistant's (Vapi's transcript, or the lines kept as they
 * were said, domain/live-call.ts) and a call made from the computer (Twilio's transcript of the recording). An entry from
 * the computer names its call by its recording mark; the assistant's entries are matched to the call that ended when they
 * were written (`transcriptFor`), so nothing new is written into the record's words. Pure: no I/O.
 */
import { recordingOf } from "./browser-call";
import { joinRuns, type LiveLine } from "./live-call";

export interface CallTranscript {
  id: string;
  /** When the call ended and was written on the deal (ISO). */
  at: string;
  kind: "assistant" | "computer";
  lines: LiveLine[];
}

const ASSISTANT = /^(ai|assistant|bot|agent)\s*:\s*/i;
const CUSTOMER = /^(user|customer|human|caller)\s*:\s*/i;

/** Vapi's transcript ("AI: …\nUser: …") as lines, each side's runs joined. */
export function linesFromVapi(transcript: string, maxLines = 400): LiveLine[] {
  const out: LiveLine[] = [];
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const role = ASSISTANT.test(line) ? "assistant" : CUSTOMER.test(line) ? "customer" : null;
    const text = line.replace(ASSISTANT, "").replace(CUSTOMER, "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (role) out.push({ role, text });
    else if (out.length) out[out.length - 1].text += ` ${text}`;
  }
  return joinRuns(out).slice(0, maxLines);
}

/** How far apart an entry and its call's end may be and still be matched and still be matched. */
export const MATCH_MINUTES = 5;

/**
 * The transcript for an entry on the timeline: a call from the computer by the recording its entry names; the
 * assistant's by the call that ended nearest the entry's time, within MATCH_MINUTES.
 */
export function transcriptFor(
  entry: { text: string; at: string },
  kind: "assistant" | "computer",
  list: readonly CallTranscript[],
): CallTranscript | null {
  const named = recordingOf(entry.text)?.callId;
  if (named) return list.find((t) => t.id === named) ?? null;
  if (kind === "computer") return null;
  const at = Date.parse(entry.at);
  if (!Number.isFinite(at)) return null;
  let best: CallTranscript | null = null;
  let gap = MATCH_MINUTES * 60_000;
  for (const t of list) {
    if (t.kind !== kind) continue;
    const d = Math.abs(Date.parse(t.at) - at);
    if (d <= gap) {
      gap = d;
      best = t;
    }
  }
  return best;
}
