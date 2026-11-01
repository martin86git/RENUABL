/**
 * The switchboard from a photo (2 Nov 2026, Martin): Sol reads the board (its phases, spare spaces, whether there is an
 * RCD and whether it still has old fuses) and a rule suggests the switchboard upgrade and RCBO lines, decided on each
 * job. Suggestions to check, never the electrician's own assessment. Pure, tested in `switchboard.test.ts`.
 */

export type Seen = "yes" | "no" | "unclear";

export interface SwitchboardRead {
  isSwitchboard: boolean;
  phase: "single" | "three" | "unclear";
  /** Empty breaker spaces on the rail (each single-pole space), when they can be counted. */
  spareSpaces: number | null;
  /** RCDs (safety switches, or RCBOs) protecting the circuits. */
  rcd: Seen;
  /** Old rewireable or ceramic fuses in place of breakers. */
  oldFuses: Seen;
  /** Anything else worth the team knowing, in a sentence (asbestos backing, no room on the rail, scorch marks). */
  notes: string;
}

export interface SwitchboardAdvice {
  /** Include the switchboard upgrade (true), leave it out (false), or check on site (null). */
  upgrade: boolean | null;
  rcbo: boolean | null;
  phase: "single" | "three" | null;
  reasons: string[];
}

/**
 * Spaces a new system takes on the board, one each for the inverter's breaker, a battery and an EV charger (VERIFY with
 * the electrician: a two-pole or three-phase breaker takes more).
 */
export function spacesNeeded(kit: { battery: boolean; ev: boolean }): number {
  return 1 + (kit.battery ? 1 : 0) + (kit.ev ? 1 : 0);
}

/** What the photo suggests for the lines decided on each job. */
export function switchboardAdvice(read: SwitchboardRead, kit: { battery: boolean; ev: boolean }): SwitchboardAdvice {
  const reasons: string[] = [];
  const need = spacesNeeded(kit);
  let upgrade: boolean | null = null;
  if (read.oldFuses === "yes") {
    upgrade = true;
    reasons.push("Old fuses on the board: an upgrade to breakers.");
  } else if (read.spareSpaces !== null && read.spareSpaces < need) {
    upgrade = true;
    reasons.push(`${read.spareSpaces} spare ${read.spareSpaces === 1 ? "space" : "spaces"}, ${need} needed: no room for the new breakers.`);
  } else if (read.oldFuses === "no" && read.spareSpaces !== null) {
    upgrade = false;
    reasons.push(`Breakers, with ${read.spareSpaces} spare ${read.spareSpaces === 1 ? "space" : "spaces"} for the ${need} needed.`);
  } else reasons.push("The spare spaces or the fuses couldn't be told from the photo: check the board on site.");
  let rcbo: boolean | null = null;
  if (read.rcd === "no") {
    rcbo = true;
    reasons.push("No safety switch seen: an RCBO protects the new circuit in one space.");
  } else if (read.rcd === "yes") {
    rcbo = false;
    reasons.push("Safety switches seen on the board.");
  } else reasons.push("Whether there's a safety switch couldn't be told: check on site.");
  if (read.notes.trim()) reasons.push(read.notes.trim().slice(0, 240));
  return { upgrade, rcbo, phase: read.phase === "unclear" ? null : read.phase, reasons };
}

/** Sol's reading of the photo, checked: anything not one of the expected answers is unclear. */
export function cleanSwitchboardRead(raw: Record<string, unknown>): SwitchboardRead {
  const seen = (v: unknown): Seen => (v === "yes" || v === "no" ? v : "unclear");
  const spare =
    typeof raw.spareSpaces === "number" && Number.isInteger(raw.spareSpaces) && raw.spareSpaces >= 0 && raw.spareSpaces <= 60
      ? raw.spareSpaces
      : null;
  return {
    isSwitchboard: raw.isSwitchboard === true,
    phase: raw.phase === "single" || raw.phase === "three" ? raw.phase : "unclear",
    spareSpaces: spare,
    rcd: seen(raw.rcd),
    oldFuses: seen(raw.oldFuses),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 300) : "",
  };
}

export const SWITCHBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isSwitchboard: { type: "boolean", description: "True only if the photo shows a home's electrical switchboard." },
    phase: {
      type: "string",
      enum: ["single", "three", "unclear"],
      description: "Three-phase when the main switch is three-pole or three phases are marked.",
    },
    spareSpaces: {
      type: ["integer", "null"] as ("integer" | "null")[],
      description: "Empty single-pole spaces on the DIN rail, counted. Null if they can't be counted.",
    },
    rcd: {
      type: "string",
      enum: ["yes", "no", "unclear"],
      description: "Whether RCDs (safety switches, with a test button) or RCBOs protect the circuits.",
    },
    oldFuses: {
      type: "string",
      enum: ["yes", "no", "unclear"],
      description: "Whether there are old rewireable or ceramic fuses rather than circuit breakers.",
    },
    notes: { type: "string", description: "One sentence on anything else an electrician would want to know. Empty if nothing." },
  },
  required: ["isSwitchboard", "phase", "spareSpaces", "rcd", "oldFuses", "notes"],
} as const;

export const SWITCHBOARD_PROMPT = `Above is a photo of a home's electrical switchboard in Australia. Read only what the photo shows, for planning a solar and battery installation: whether it is three-phase or single-phase, how many empty single-pole spaces there are on the rail, whether there are safety switches (RCDs or RCBOs, with a test button), and whether it still has old rewireable or ceramic fuses. Say "unclear" (or null) for anything you can't see plainly: never guess.`;
