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
  | "backup-both"
  | "line-on"
  | "line-off"
  /** Included in the second version only (`NudgeState.versions`), left out of the first. */
  | "line-v2"
  /** Read and understood: the note is put aside. */
  | "ok"
  | "finalise"
  | "request-preapproval";

export interface NudgeAction {
  label: string;
  act: NudgeAct;
  /** For a cost decided on each job: the quote line's label. */
  line?: string;
}

/** The battery's surroundings a question is about, drawn beside it. */
export type BatteryPicture = "bollard" | "fire-sheeting" | "awning";

export interface Nudge {
  /** The same nudge keeps its id while it still applies, so putting it aside holds. */
  id: string;
  kind: "needed" | "question" | "option" | "next";
  words: string;
  /** One line on why, when it helps. */
  why?: string;
  /**
   * A small drawing beside the words (14 Nov 2026, Martin: asked about a bollard or fire sheeting, the roof is no help;
   * show a battery on a wall and what the thing is).
   */
  picture?: BatteryPicture;
  /** A count asked with the answer (19 Nov 2026, Martin: "on the question about adding RCBO's - it should ask me for a quantity"). */
  count?: { label: string; start: number };
  /** The ways open to the designer, said only: Sol can't do them himself (12 Nov 2026, Martin). */
  options?: string[];
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
  /** Strings holding a shaded panel: its letter, how many shaded and how many open panels share it. */
  shadedStrings?: { letter: string; shaded: number; others: number }[];
  /** Labels of the costs decided on each job still undecided. */
  undecided: string[];
  /** Backup has been answered on this visit (no is no). */
  backupAnswered: boolean;
  /** The member can't see costs: no questions about cost lines. */
  costsHidden: boolean;
  /**
   * The deal's network and where its pre-approval stands (19 Nov 2026, Martin: say who the distributor is and offer to
   * raise the pre-approval request). Left out off a deal, or before the deal is read.
   */
  network?: { name: string | null; guessed: boolean; preApproval: string | null; mayRequest: boolean };
  /**
   * Two versions made from Sol's guide (19 Nov 2026, Martin: "all the other questions like add a switchboard etc, should
   * ask me to apply it to one of the versions - say v2. that way i get one version thats bare, and one version that has
   * all the extras"): each cost decided on each job is then offered for v2 alone first.
   */
  versions?: boolean;
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

/** The question each cost decided on each job is asked as, and the count asked with it when it is counted. */
const LINE_QUESTIONS: [RegExp, string, string, BatteryPicture?, string?][] = [
  [/^Switchboard upgrade/i, "Does the switchboard need upgrading?", "Old fuses, or no room for the new breakers, mean it does."],
  [/^RCBO/i, "Does it need RCBOs (safety switches)? How many?", "Usually yes when the board has none on the circuits.", undefined, "RCBOs"],
  [/^Protective bollard/i, "Does the battery need a protective bollard?", "Where a car could reach it, in a garage or a drive.", "bollard"],
  [
    /^Fireproofing/i,
    "Does the wall behind the battery need fireproof sheeting?",
    "On a wall of a habitable room, or one that isn't fire rated.",
    "fire-sheeting",
  ],
  [/^Shade awning/i, "Does the battery need a shade awning?", "Outside in the sun, where its maker asks for shade.", "awning"],
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
        // Two options on the proposal, one each (19 Nov 2026, Martin: "one with battery black out back up and one without").
        { label: "Both, as two options", act: "backup-both" },
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
        ...(q?.[3] ? { picture: q[3] } : {}),
        ...(q?.[4] ? { count: { label: q[4], start: 1 } } : {}),
        actions: s.versions
          ? [
              { label: "Yes, in v2 only", act: "line-v2", line: label },
              { label: "Yes, in both", act: "line-on", line: label },
              { label: "No", act: "line-off", line: label },
            ]
          : [
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
  if (s.shaded > 0) out.push(shadeNudge(s));
  if (s.phase === "single" && s.kw > SINGLE_PHASE_KW) {
    const exportNudge = preApprovalNudge(s);
    if (exportNudge) out.push(exportNudge);
  }
  // The way on (15 Nov 2026, Martin: once the panels are laid and the battery added, Sol leads on to the quote, then the
  // proposal): last, once the panels are on an inverter and all strung.
  if (!s.costsHidden && s.panels > 0 && s.inverters > 0 && s.unstrung === 0)
    out.push({
      id: "finalise",
      kind: "next",
      words: "The design is ready. Let's finalise the quote.",
      why: "Check the lines and decide what's still open, then on to the proposal.",
      actions: [
        { label: "Finalise the quote", act: "finalise" },
        { label: "Not now", act: "ok" },
      ],
    });
  return out;
}

/**
 * Over the single-phase size (19 Nov 2026, Martin: "it should be able to tell me who the network distributor is - and ask
 * me whether i want to raise a request for a network pre approval. that request would then flow into the pre approvals
 * bucket"): the network by name, how sure that is, and a press that asks for the pre-approval on the deal. Nothing is
 * sent to the network: the request lands in Pre-approvals for someone to submit. Gone once the network has approved.
 */
function preApprovalNudge(s: NudgeState): Nudge | null {
  const net = s.network;
  const who = net?.name ?? "the network";
  const over = `Over ${SINGLE_PHASE_KW} kW on single phase`;
  const where = net?.name
    ? net.guessed
      ? `${net.name} going by the postcode: the NMI on the bill settles it.`
      : `The home is on ${net.name}'s network.`
    : undefined;
  const v = net?.preApproval ?? null;
  if (v === "Approved" || v === "Approved, export limited" || v === "Not required") return null;
  if (v && v !== "Not submitted")
    return {
      id: "export",
      kind: "option",
      words: `${over}. Pre-approval with ${who}: ${v === "Requested" ? "requested, waiting in Pre-approvals to be submitted" : v.toLowerCase()}.`,
      ...(where ? { why: where } : {}),
      // Read and understood (19 Nov 2026, Martin: "this should have a button acknowledged or OK").
      actions: [{ label: "OK", act: "ok" }],
    };
  const ask = Boolean(net && s.onDeal && net.mayRequest);
  return {
    id: "export",
    kind: "option",
    words: `${over}, so ${who} will likely need to pre-approve it, or limit its exports.${ask ? " Raise a pre-approval request?" : ""}`,
    why:
      where ??
      (s.onDeal ? "Add the home's NMI to the deal to know its network." : "Put the design on a deal to raise a pre-approval request."),
    actions: ask
      ? [
          { label: "Yes, raise the request", act: "request-preapproval" },
          { label: "No", act: "ok" },
        ]
      : [{ label: "OK", act: "ok" }],
  };
}

/**
 * Shaded panels (12 Nov 2026, Martin: Sol said a panel lost 20% and suggested nothing, and one shaded panel on a string
 * holds the whole string back): what it costs, and the ways to put it right, said, not done, since each is the
 * designer's call (an optimiser, the wiring, where the panels go).
 */
function shadeNudge(s: NudgeState): Nudge {
  const one = s.shaded === 1;
  const loss = `${s.shaded} panel${one ? " loses" : "s lose"} over ${Math.round(SHADE_LOSS * 100)}% of the year's sun to shade.`;
  const mixed = (s.shadedStrings ?? []).filter((x) => x.others > 0);
  const why = mixed.length
    ? `${one ? "It shares" : "They share"} ${mixed.length === 1 ? `string ${mixed[0].letter}` : `strings ${mixed.map((x) => x.letter).join(" and ")}`} with open panels, and a shaded panel holds back every panel on its string.`
    : "A shaded panel holds back every panel on its string, so it's worth sorting before stringing.";
  const it = one ? "that panel" : "each shaded panel";
  return {
    id: "shade",
    kind: "option",
    words: loss,
    why,
    options: [
      `Fit an optimiser (a Tigo TS4-A-O) on ${it} only, so the rest of the string runs at full output.`,
      `Rewire: put ${one ? "it" : "them"} on a string of ${one ? "its" : "their"} own, or on the inverter's other input.`,
      `Move ${one ? "it" : "them"} to a sunnier part of the roof.`,
      `Take ${one ? "it" : "them"} off: the system is a little smaller, the string isn't held back.`,
    ],
    actions: [{ label: "Show the shade", act: "show-shade" }],
  };
}

/** The kind as a few words over the nudge. */
export const NUDGE_KIND_WORDS: Record<Nudge["kind"], string> = {
  needed: "Needed",
  question: "For the quote",
  option: "An option",
  next: "Next step",
};

/**
 * How a roof was when it was opened (20 Nov 2026, Martin: the designer opened on "Do they want blackout backup?" every
 * time; "if a design has been completed end to end, then Sol should remain inactive unless prompted. however, if we
 * only got halfway through, then Sol should say here's where we left off… and then ask the question where we left off").
 * Nothing drawn is new (his guide leads); every readiness check passed is done (Sol keeps quiet until something changes
 * or he's asked); anything else is part way.
 */
export type OpenedAs = "new" | "done" | "partway";

export function openedAs(s: { panels: number; battery: boolean; ready: boolean }): OpenedAs {
  if (s.panels <= 0 && !s.battery) return "new";
  return s.ready ? "done" : "partway";
}

/** The line over Sol's first card on a design opened part way: what is there, then on to the question. */
export function leftOffWords(s: { panels: number; kw: number; batteryKwh: number | null }): string {
  const parts: string[] = [];
  if (s.panels > 0) parts.push(`${s.panels} panel${s.panels === 1 ? "" : "s"}, ${s.kw.toFixed(2)} kW`);
  if (s.batteryKwh) parts.push(`a battery of ${round1(s.batteryKwh)} kWh`);
  return `Here's where we left off: ${parts.join(" with ") || "the design so far"}. Picking up from here:`;
}
