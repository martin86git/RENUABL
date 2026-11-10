/**
 * Sol beside the design as it is drawn (10 Nov 2026, Martin: "it needs to be able to give you options as you're
 * designing", and "Sol should be asking the questions the quote needs to proceed, such as do you want backup, do we need
 * a switchboard upgrade"). Pure, tested; worked out by rule from the design as it stands, so it costs nothing and needs
 * no Claude.
 *
 * Three kinds, in this order: what the design can't go on without (an inverter, the home's use), the questions the
 * quote needs answered (blackout backup, and each cost decided on each job), then options that would make it better
 * (strings, the inverter's size, a battery for the evenings, panels to fill the battery, shade). One is shown at a time;
 * each has its answer or action, and every one can be put aside for the visit.
 */

/** What a press does: the designer carries it out. */
export type NudgeAct =
  | "suggest-inverter"
  | "find-usage"
  | "open-bill"
  | "string"
  | "battery-menu"
  | "add-panels"
  | "show-shade"
  | "backup-yes"
  | "backup-no"
  | "line-on"
  | "line-off";

export interface NudgeAction {
  label: string;
  act: NudgeAct;
  /** For a cost decided on each job: the quote line's label. */
  line?: string;
}

export interface Nudge {
  /** The same nudge keeps its id while it still applies, so putting it aside holds. */
  id: string;
  kind: "needed" | "question" | "option";
  words: string;
  /** One line on why, when it helps. */
  why?: string;
  actions: NudgeAction[];
}

export interface NudgeState {
  panels: number;
  /** kW of panels. */
  kw: number;
  /** kW of inverter on the design, and how many inverters. */
  inverterKw: number;
  inverters: number;
  /** Panels not on a string, once there are inverters. */
  unstrung: number;
  /** Panels over the inverter's limit: its share and the limit, in percent. */
  oversize: { percent: number; limit: number; over: boolean } | null;
  battery: { kwh: number; backup?: boolean } | null;
  /** How full the panels get the battery on an average day (`batteryFill`). */
  fill: { share: number; limit: "panels" | "evenings" | null } | null;
  /** What one more panel makes on an average day, kWh. */
  panelDayKwh: number;
  /** The home's daily use, kWh, when the bill is in. */
  homeDayKwh: number | null;
  /** The design is on a deal (Sol can look through the customer's file). */
  onDeal: boolean;
  phase: "single" | "three";
  /** Panels losing more than `SHADE_LOSS` of the year's sun, when the shade is read. */
  shaded: number;
  /** Labels of the costs decided on each job still undecided. */
  undecided: string[];
  /** Backup has been answered on this visit (no is no). */
  backupAnswered: boolean;
  /** The member can't see costs: no questions about cost lines. */
  costsHidden: boolean;
}

/** Evenings at least this many kWh make a battery worth suggesting. */
export const EVENINGS_WORTH_A_BATTERY = 5;
/** A battery filled to less than this share by the panels is worth more panels. */
export const FILL_WORTH_MORE = 0.85;
/** A panel losing more than this share of the year's sun to shade is worth moving. */
export const SHADE_LOSS = 0.2;
/** Over this on single phase, the network's pre-approval or export limiting is likely needed (VERIFY per network). */
export const SINGLE_PHASE_KW = 5;
const EVENING_SHARE = 0.6;
const SELF_USE = 0.4;
const USABLE = 0.9;

/** The question each cost decided on each job is asked as. */
const LINE_QUESTIONS: [RegExp, string, string][] = [
  [/^Switchboard upgrade/i, "Does the switchboard need upgrading?", "Old fuses, or no room for the new breakers, mean it does."],
  [/^RCBO/i, "Does it need RCBOs (safety switches)?", "Usually yes when the board has none on the circuits."],
  [/^Protective bollard/i, "Does the battery need a protective bollard?", "Where a car could reach it, in a garage or a drive."],
  [
    /^Fireproofing/i,
    "Does the wall behind the battery need fireproof sheeting?",
    "On a wall of a habitable room, or one that isn't fire rated.",
  ],
  [/^Shade awning/i, "Does the battery need a shade awning?", "Outside in the sun, where its maker asks for shade."],
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function nudgesFor(s: NudgeState): Nudge[] {
  if (s.panels <= 0 && !s.battery) return [];
  const out: Nudge[] = [];

  // What the design can't go on without.
  if (s.panels > 0 && !s.inverters)
    out.push({
      id: "inverter",
      kind: "needed",
      words: `No inverter yet for ${s.kw.toFixed(2)} kW of panels.`,
      actions: [{ label: "Suggest one", act: "suggest-inverter" }],
    });
  if (s.homeDayKwh === null)
    out.push({
      id: "bill",
      kind: "needed",
      words: "I don't have the home's use yet, so the battery, saving and payback are guesses.",
      actions: s.onDeal
        ? [
            { label: "Find it in their file", act: "find-usage" },
            { label: "Add the bill", act: "open-bill" },
          ]
        : [{ label: "Add the bill", act: "open-bill" }],
    });

  // The questions the quote needs answered.
  if (s.battery && s.battery.backup === undefined && !s.backupAnswered)
    out.push({
      id: "backup",
      kind: "question",
      words: "Do they want blackout backup?",
      why: "Backup circuits wired to the battery keep chosen circuits on in a blackout, and a module is held for it.",
      actions: [
        { label: "Yes, wire backup", act: "backup-yes" },
        { label: "No", act: "backup-no" },
      ],
    });
  if (!s.costsHidden)
    for (const label of s.undecided) {
      const q = LINE_QUESTIONS.find(([re]) => re.test(label));
      out.push({
        id: `line:${label}`,
        kind: "question",
        words: q?.[1] ?? `Include “${label}”?`,
        ...(q ? { why: q[2] } : {}),
        actions: [
          { label: "Yes, include it", act: "line-on", line: label },
          { label: "No", act: "line-off", line: label },
        ],
      });
    }

  // Options that would make it better.
  if (s.inverters && s.unstrung > 0)
    out.push({
      id: "strings",
      kind: "option",
      words: `${s.unstrung} panel${s.unstrung === 1 ? " isn't" : "s aren't"} on a string.`,
      actions: [{ label: "String them", act: "string" }],
    });
  if (s.oversize?.over)
    out.push({
      id: "oversize",
      kind: "option",
      words: `The panels are ${s.oversize.percent}% of the inverter, over the ${s.oversize.limit}% allowed.`,
      actions: [{ label: "A bigger inverter", act: "suggest-inverter" }],
    });
  const evenings = s.homeDayKwh !== null ? s.homeDayKwh * EVENING_SHARE : null;
  if (!s.battery && s.panels > 0 && evenings !== null && evenings >= EVENINGS_WORTH_A_BATTERY)
    out.push({
      id: "battery",
      kind: "option",
      words: `They use about ${round1(evenings)} kWh after dark. A battery would carry the panels' spare into the evening.`,
      actions: [{ label: "Add a battery", act: "battery-menu" }],
    });
  if (s.battery && s.fill && s.fill.limit === "panels" && s.fill.share < FILL_WORTH_MORE && s.panelDayKwh > 0) {
    // What it would take to fill: the battery's usable kWh over what each panel spares on an average day.
    const holds = s.battery.kwh * USABLE;
    const short = holds * (1 - s.fill.share);
    const more = Math.max(1, Math.ceil(short / (s.panelDayKwh * (1 - SELF_USE))));
    out.push({
      id: "fill",
      kind: "option",
      words: `The panels fill the battery to about ${Math.round(s.fill.share * 100)}%. About ${more} more panel${more === 1 ? "" : "s"} would fill it.`,
      actions: [{ label: "Add panels", act: "add-panels" }],
    });
  }
  if (s.shaded > 0)
    out.push({
      id: "shade",
      kind: "option",
      words: `${s.shaded} panel${s.shaded === 1 ? " loses" : "s lose"} over ${Math.round(SHADE_LOSS * 100)}% of the year's sun to shade.`,
      actions: [{ label: "Show the shade", act: "show-shade" }],
    });
  if (s.phase === "single" && s.kw > SINGLE_PHASE_KW)
    out.push({
      id: "export",
      kind: "option",
      words: `Over ${SINGLE_PHASE_KW} kW on single phase: the network's pre-approval or export limiting is likely needed.`,
      actions: [],
    });
  return out;
}

/** The kind as a few words over the nudge. */
export const NUDGE_KIND_WORDS: Record<Nudge["kind"], string> = {
  needed: "Needed",
  question: "For the quote",
  option: "An option",
};
