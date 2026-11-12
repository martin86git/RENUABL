/**
 * Watching the phone assistant's call as it happens (12 Nov 2026, Martin: pressing Call should feel like handing the
 * call to Charlie, his picture and all, and while he rings a window shows how long the call has run and what is being
 * said). Vapi tells our webhook the call's status ("status-update") and each thing said ("transcript", partial while
 * it is being said, final once said); `server/voice-calls.ts` keeps them on the call, and the browser asks for them
 * every moment or two (`/api/design/jobs/[id]/call/live`). Pure: no I/O.
 */
import type { CallOutcome } from "./voice-agent";

/** Who said a line: the business's assistant, or the customer. */
export type LiveRole = "assistant" | "customer";

export interface LiveLine {
  role: LiveRole;
  text: string;
}

/** What a Vapi server message means for the live view, if anything. */
export type LiveEvent =
  | { kind: "status"; callId: string | null; status: VapiStatus }
  | { kind: "line"; callId: string | null; role: LiveRole; text: string; final: boolean };

export type VapiStatus = "scheduled" | "queued" | "ringing" | "in-progress" | "forwarding" | "ended";
const STATUSES: readonly VapiStatus[] = ["scheduled", "queued", "ringing", "in-progress", "forwarding", "ended"];

/** The longest line kept, and how many lines a call keeps. */
export const MAX_LINE_CHARS = 1_000;
export const MAX_LINES = 400;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_LINE_CHARS);

/** Reads a Vapi server message for the live view: its status, or a line said. Null for anything else. */
export function readLiveEvent(body: unknown): LiveEvent | null {
  const m = ((body as { message?: unknown })?.message ?? {}) as Record<string, unknown>;
  const call = (m.call ?? {}) as Record<string, unknown>;
  const callId = typeof call.id === "string" ? call.id : null;
  if (m.type === "status-update") {
    const status = STATUSES.find((s) => s === m.status);
    return status ? { kind: "status", callId, status } : null;
  }
  if (typeof m.type === "string" && m.type.startsWith("transcript")) {
    const text = typeof m.transcript === "string" ? tidy(m.transcript) : "";
    const role: LiveRole | null = m.role === "assistant" ? "assistant" : m.role === "user" ? "customer" : null;
    if (!text || !role) return null;
    return { kind: "line", callId, role, text, final: m.transcriptType === "final" };
  }
  return null;
}

/** Where a call stands, for the window. */
export type LivePhase = "lined-up" | "ringing" | "on-call" | "trying-again" | "ended";

export function livePhase(o: { status: string; liveStatus: string | null }): LivePhase {
  const done = o.status !== "waiting" && o.status !== "calling";
  if (o.liveStatus === "in-progress" || o.liveStatus === "forwarding") return "on-call";
  if (o.liveStatus === "ringing") return "ringing";
  if (o.liveStatus === "ended") return done ? "ended" : "trying-again";
  return done ? "ended" : "lined-up";
}

/** The window's line under the assistant's name: "calling Jo", "on the call with Jo"… */
export function phaseWords(phase: LivePhase, customer: string): string {
  const who = customer || "the customer";
  if (phase === "lined-up") return `will call ${who}`;
  if (phase === "ringing") return `is ringing ${who}…`;
  if (phase === "on-call") return `is on the call with ${who}`;
  if (phase === "trying-again") return `couldn't reach ${who} and will try again`;
  return `called ${who}`;
}

/** "1:05", "12:40". */
export function clockWords(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Joins a run of lines by the same side said one after another, as the window shows them. */
export function joinRuns(lines: readonly LiveLine[]): LiveLine[] {
  const out: LiveLine[] = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && last.role === l.role) last.text = `${last.text} ${l.text}`;
    else out.push({ ...l });
  }
  return out;
}

/** The call as the window gets it from the server. */
export interface LiveCallView {
  phase: LivePhase;
  customer: string;
  outcome: CallOutcome | null;
  /** The time booked on the call, when one was. */
  booked: string | null;
  attempts: number;
  /** How long ago the call was answered, and how long it ran, on the server's clock (ms). */
  startedAgo: number | null;
  ranFor: number | null;
  lines: LiveLine[];
  partial: LiveLine | null;
}
