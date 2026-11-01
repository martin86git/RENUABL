/**
 * The call note-taker (1 Nov 2026, Martin: Primero's copied across, wave 7). On a deal, the member switches the
 * computer's microphone on for a call taken on their phone: the browser hears their side only, and turns it into
 * words in the page. Nothing is recorded or kept. At the end, Claude distils what was heard (and notes the member
 * added on purpose) into what the follow-up email and the design need; the member checks it and adds it to the deal
 * as a note. Pure: no I/O.
 */

/** One stretch of what the microphone heard, or a note the member added (spoken or typed) on purpose. */
export interface HeardLine {
  at: string;
  text: string;
  /** Added on purpose, not heard on the call. */
  note?: boolean;
  /** A note marked as for the design (the system), not the conversation. */
  design?: boolean;
}

export const INTENDED_FIELDS = [
  ["solar", "Solar"],
  ["panels", "Panels"],
  ["inverter", "Inverter"],
  ["battery", "Battery"],
  ["phase", "Phase"],
  ["roof", "Roof"],
  ["storeys", "Storeys"],
  ["existing", "Existing system"],
  ["ev", "EV charger"],
  ["switchboard", "Switchboard"],
  ["budget", "Budget"],
  ["timing", "Timing"],
] as const;
export type IntendedField = (typeof INTENDED_FIELDS)[number][0];
export type IntendedSystem = Record<IntendedField, string>;

export interface CallNotes {
  /** Two sentences at most: what the customer wants and where it was left. */
  summary: string;
  /** The conversation itself, for the recap email. */
  conversation: string[];
  /** For the design: what shapes the system that the fields don't hold. */
  forDesign: string[];
  /** What the member said they'd send, confirm or follow up on. */
  forEmail: string[];
  nextStep: string;
  toCheck: string[];
  /** The system the call points to, field by field, as said ("" where nothing was said). */
  system: IntendedSystem;
}

export const emptySystem = (): IntendedSystem => Object.fromEntries(INTENDED_FIELDS.map(([k]) => [k, ""])) as IntendedSystem;

export function systemLines(s: IntendedSystem): { key: IntendedField; label: string; value: string }[] {
  return INTENDED_FIELDS.filter(([k]) => s[k]).map(([key, label]) => ({ key, label, value: s[key] }));
}

/** Under this many words heard, there is nothing to distil. */
export const MIN_WORDS = 8;
/** What is sent to Claude, at most (a long call is about 6,000 words of one side). */
export const MAX_CHARS = 40_000;

export function wordsIn(lines: readonly HeardLine[]): number {
  return lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
}

/** The lines as Claude reads them: in order, notes marked, cut from the front if too long (the end of a call matters most). */
export function transcriptOf(lines: readonly HeardLine[]): string {
  const text = lines
    .map((l) => ({ l, t: l.text.trim() }))
    .filter(({ t }) => t)
    .map(({ l, t }) => (l.note ? `${l.design ? "[Design note]" : "[Note]"} ${t}` : t))
    .join("\n");
  return text.length > MAX_CHARS ? text.slice(text.length - MAX_CHARS) : text;
}

/** What the browser sends as heard lines, kept to their shape and lengths. */
export function cleanHeard(raw: unknown): HeardLine[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => ({
      at: String(l.at ?? "").slice(0, 10),
      text: String(l.text ?? "").slice(0, 2_000),
      ...(l.note === true ? { note: true } : {}),
      ...(l.design === true ? { design: true } : {}),
    }))
    .slice(0, 2_000);
}

export const CALL_NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "conversation", "forDesign", "forEmail", "nextStep", "toCheck", "system"],
  properties: {
    system: {
      type: "object",
      additionalProperties: false,
      required: INTENDED_FIELDS.map(([k]) => k),
      properties: Object.fromEntries(INTENDED_FIELDS.map(([k]) => [k, { type: "string" as const }])),
    },
    summary: { type: "string" },
    conversation: { type: "array", items: { type: "string" } },
    forDesign: { type: "array", items: { type: "string" } },
    forEmail: { type: "array", items: { type: "string" } },
    nextStep: { type: "string" },
    toCheck: { type: "array", items: { type: "string" } },
  },
} as const;

export function callNotesPrompt(business: string, customer: string, transcript: string): string {
  return [
    `You are taking notes for a salesperson at ${business || "a solar business"} (solar panels, batteries and EV chargers in Australia), on their call with ${customer || "a customer"}.`,
    `Below is what a microphone heard of the salesperson's side of the call, as speech recognition wrote it: only their words, never the customer's, so infer what the customer said only from what the salesperson says back. Speech recognition gets numbers and names wrong: read "10 kilowatt", "ten kW" and "10 KW" as 10 kW, and a battery's size in kWh. Lines starting [Note] are general notes they added on purpose, and [Design note] are notes for the design: give both priority, and put each where it was meant.`,
    "The notes serve two people, so keep the two halves apart: first the conversation, for the follow-up email that recaps the call; then the system, for whoever designs and prices it.",
    "As short plain lines in Australian English:",
    "- summary: at most two sentences: what the customer wants and where it was left.",
    "- conversation: the points a recap email should reflect back: why they want it and what matters most to them, their situation, questions they asked and how they were answered, worries and what was said to them, other quotes they mentioned, what was agreed. Not system figures.",
    "- forEmail: what the salesperson said they would send, confirm or follow up on, each as one line.",
    `- nextStep: the next step and when, as said ("Send the quote by Thursday"); empty if none was said.`,
    "- toCheck: what the salesperson said they would check, find out or wasn't sure of.",
    "- forDesign: everything that shapes the system that the fields below don't hold: products wanted or to avoid, where things go, shade, the switchboard, access.",
    "- system: each field a few words as it was said, or an empty string: solar (kW), panels, inverter, battery (kWh), phase, roof, storeys, existing (a system already there, and whether it stays), ev, switchboard, budget, timing. Where two choices were offered, say both.",
    "Only what was said: never invent a figure, a product, a price, a date or a promise. Leave a list empty rather than guess. Don't repeat a point across lists. Don't name anyone but the customer.",
    "",
    "What was heard:",
    transcript,
  ].join("\n");
}

const lineList = (v: unknown, max = 12): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, max)
    : [];

/** What Claude sent back, kept to its shape and lengths. */
export function cleanCallNotes(raw: unknown): CallNotes {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const sys = (r.system && typeof r.system === "object" ? r.system : {}) as Record<string, unknown>;
  const system = emptySystem();
  for (const [k] of INTENDED_FIELDS) system[k] = str(sys[k], 120);
  return {
    summary: str(r.summary, 500),
    conversation: lineList(r.conversation, 16),
    forDesign: lineList(r.forDesign),
    forEmail: lineList(r.forEmail),
    nextStep: str(r.nextStep, 300),
    toCheck: lineList(r.toCheck),
    system,
  };
}

export const DESIGN_RULE = "—— For the design ——";

/** The notes as the words that go on the deal, which the member can still change: the conversation first, then the system. */
export function callNotesText(n: CallNotes): string {
  const part = (title: string, lines: string[]) => (lines.length ? [`${title}:`, ...lines.map((l) => `- ${l}`), ""] : []);
  const design = systemLines(n.system).length || n.forDesign.length;
  return [
    ...(n.summary ? [n.summary, ""] : []),
    ...part("From the conversation", n.conversation),
    ...part("For the follow-up email", n.forEmail),
    ...(n.nextStep ? [`Next step: ${n.nextStep}`, ""] : []),
    ...part("To check", n.toCheck),
    ...(design ? [DESIGN_RULE, ""] : []),
    ...part(
      "The intended system",
      systemLines(n.system).map((l) => `${l.label}: ${l.value}`),
    ),
    ...part("For the design", n.forDesign),
  ]
    .join("\n")
    .trim();
}
