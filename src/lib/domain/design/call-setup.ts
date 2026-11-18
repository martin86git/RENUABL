/**
 * Who a voice agent says it is, and why it is ringing (18 Nov 2026, Martin: "we are missing fields for me to enter the
 * consultants name… a name field and perhaps a pronunciation field… a section that says reason for the call as i may
 * want to change from calling people who left an enquiry to cold calling").
 *
 * Three things the business sets beside the agent's chat, each used on its next call:
 * - **Said as**: how the voice should say the agent's name. A voice reads spelling, so a note about pronunciation
 *   changes nothing (said-as.ts); the lines the agent is given to say carry this form in place of the name.
 * - **Who it rings**: people who enquired (the calls as they were), or people who haven't been in touch (cold calls).
 * - **Reason for the call**: the words after "calling" in its opening. Blank is the usual reason for who it rings.
 *
 * None of it changes a rule: the agent still says it is automated, whose assistant it is, and takes a no the first
 * time. On a cold call it is also told never to imply they enquired. Pure, tested.
 */

export const CALL_AUDIENCES = ["enquired", "cold"] as const;
export type CallAudience = (typeof CALL_AUDIENCES)[number];

export interface CallSetup {
  /** How the name is written for the voice ("Shar-lee"); "" says it as spelled. */
  saidAs: string;
  audience: CallAudience;
  /** The words after "calling" in the opening; "" is the usual reason for the audience. */
  reason: string;
}

export const DEFAULT_CALL_SETUP: CallSetup = { saidAs: "", audience: "enquired", reason: "" };

export const SAID_AS_MAX = 30;
export const REASON_MAX = 160;

/** The reason while none is typed, as the words after "calling". */
export const USUAL_REASON: Record<CallAudience, string> = {
  enquired: "about the solar enquiry you made on our website",
  cold: "to see whether solar or a battery is something you've thought about for your home",
};

/** A name as a voice can say it: letters, spaces, apostrophes and hyphens. */
export function cleanSaidAs(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[^\p{L}\p{M}' -]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SAID_AS_MAX)
    .trim();
}

/** How a reason may start so it reads on after "calling". */
const READS_ON = /^(about|to|because|as|regarding|on|for|from|with|in|after|since|following)\b/i;

/**
 * The reason as typed, made to read on after "calling": one plain line, no "I'm calling" in front, no full stop, and
 * "about" put before a bare subject ("your solar enquiry").
 */
export function cleanReason(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let t = raw
    .replace(/[^\p{L}\p{M}\p{N} ,'&()$%/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^(?:(?:i\s?'?\s?a?m|we\s?'?\s?(?:a?re)?|it\s?'?s)\s+)?(?:just\s+)?(?:calling|ringing|phoning)\s+/i, "").trim();
  if (t.length < 3) return "";
  if (!READS_ON.test(t)) t = `about ${t}`;
  t = t.slice(0, REASON_MAX).trim();
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function cleanCallSetup(raw: unknown): CallSetup {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    saidAs: cleanSaidAs(s.saidAs),
    audience: CALL_AUDIENCES.includes(s.audience as CallAudience) ? (s.audience as CallAudience) : "enquired",
    reason: cleanReason(s.reason),
  };
}

export const sameCallSetup = (a: CallSetup, b: CallSetup): boolean =>
  a.saidAs === b.saidAs && a.audience === b.audience && a.reason === b.reason;

/** The words after "calling" on this agent's calls. */
/** Who is rung and why, as a call or the settings hold it (either may be unset). */
export type CallWhy = { audience?: CallAudience; reason?: string | null };

export function reasonWords(s: CallWhy | null | undefined): string {
  const audience = s?.audience === "cold" ? "cold" : "enquired";
  return cleanReason(s?.reason) || USUAL_REASON[audience];
}

/** Whether the calls are as they always were: people who enquired, with the usual reason. */
export const usualCalls = (s: CallWhy | null | undefined): boolean => s?.audience !== "cold" && !cleanReason(s?.reason);

/** The name as the voice is given it: the said-as form when there is one, else the name. */
export function sayName(o: { assistant: string; assistantSaid?: string | null }): string {
  const plain = (v: string | null | undefined) =>
    (v ?? "")
      .replace(/[^\p{L}\p{M}' -]/gu, "")
      .trim()
      .slice(0, SAID_AS_MAX);
  return cleanSaidAs(o.assistantSaid) || plain(o.assistant).slice(0, 20) || "Sol";
}

/**
 * The line of a call's rules that says how the agent's own name is spoken, or "" when it is said as written. The
 * agent's instructions call it by the said form throughout, so it only needs the spelling for when someone asks.
 */
export function sayNameNote(o: { assistant: string; assistantSaid?: string | null }): string {
  const said = cleanSaidAs(o.assistantSaid);
  const name = o.assistant
    .replace(/[^\p{L}\p{M}' -]/gu, "")
    .trim()
    .slice(0, 20);
  if (!said || !name || said.toLowerCase() === name.toLowerCase()) return "";
  return `- Your name is spelled "${name}" and said "${said}". Your words are read out by a voice that says what it sees, so whenever you say your name, write it as "${said}" (as these instructions do). Only if someone asks how it's spelled, spell it out: ${name.toUpperCase().split("").join("-")}.`;
}

/** The opening as the business will hear it, for the settings panel: the same words a call is given. */
export function openingPreview(o: { name: string; saidAs: string; business: string; audience: CallAudience; reason: string }): string {
  const who = sayName({ assistant: o.name, assistantSaid: o.saidAs });
  const business = o.business.trim() || "your business";
  return `Hi, is that Sam? … It's ${who}, ${business}'s automated assistant, calling ${reasonWords(o)}. Have you got a few minutes?`;
}

export const CALL_SETUP_COPY = {
  title: "Name and reason for the call",
  name: "Name",
  nameHint: "What it calls itself on every call.",
  saidAs: "Said as",
  saidAsHint: "Only if the voice says the name wrong: write it the way it sounds, like Shar-lee.",
  audience: "Who it rings",
  audiences: {
    enquired: ["People who enquired", "They left their details and agreed to be contacted."],
    cold: ["Cold calls", "They haven't been in touch with you and aren't expecting the call."],
  } as Record<CallAudience, readonly [string, string]>,
  reason: "Reason for the call",
  reasonHint: "The words after “calling” in its opening. Leave it blank for the usual reason.",
  opening: "How the call opens",
  cold: "Cold calls have rules of their own: the Do Not Call Register, the hours you may ring, and saying who you are and how you got their number when asked. Check them before ringing anyone. It never says they enquired, and it takes a no the first time.",
  saved: "Saved. Used from the next call.",
  summary: (name: string, s: CallSetup | null): string =>
    `${name} · ${s?.audience === "cold" ? "cold calls" : s?.reason ? "your own reason" : "people who enquired"}`,
} as const;
