/**
 * "Did you know?" in the designer (10 Nov 2026, Martin: pointers for the designer, above all for new users; switched on
 * and off by a lightbulb). Pure, tested.
 *
 * A tip answers what the designer just did, never a random fact: each waits for its moment (`on`, so many times, `times`)
 * and is shown once a person, ever. At most `TIP_RULES.perVisit` a visit, none in the first `quietSeconds` and none
 * while they drag or type; it goes by itself after `showSeconds`. Where a tip names something the designer does, "Show
 * me" does it (`act`).
 */

/** What the designer did that a tip can answer. */
export type TipMoment =
  /** Moved one panel by hand. */
  | "one-panel-moved"
  /** Laid one panel with Add a panel. */
  | "one-panel-added"
  /** Strung panels by hand. */
  | "strung-by-hand"
  /** Typed the customer's bill in. */
  | "bill-typed"
  /** Pressed Ask Sol (rather than "/"). */
  | "sol-pressed"
  /** Traced a roof face by hand on a Nearmap picture. */
  | "face-traced";

/** What "Show me" does. */
export type TipAct = "pick-all" | "design-for-me" | "string-for-me";

export interface DesignTip {
  id: string;
  on: TipMoment;
  /** How many times the moment comes before the tip is worth showing. */
  times: number;
  words: string;
  act?: TipAct;
}

export const DESIGN_TIPS: readonly DesignTip[] = [
  {
    id: "pick-all",
    on: "one-panel-moved",
    times: 3,
    words: "Ctrl+A picks every panel, so a whole layout moves or turns at once. Drag a box round some to pick just those.",
    act: "pick-all",
  },
  {
    id: "edge-ghost",
    on: "one-panel-added",
    times: 3,
    words:
      "With Select, rest the pointer just past a panel's side: the next panel shows itself there. Press to place it, or drag to lay a row.",
  },
  {
    id: "string-for-me",
    on: "strung-by-hand",
    times: 1,
    words: "String automatically strings the panels by the inverter's limits, checked for the coldest morning.",
    act: "string-for-me",
  },
  {
    id: "design-from-bill",
    on: "bill-typed",
    times: 1,
    words: "With the bill in, Design it for me makes three designs sized to it: fastest payback, best return and most independence.",
    act: "design-for-me",
  },
  {
    id: "slash-for-sol",
    on: "sol-pressed",
    times: 2,
    words: "Press / anywhere on the designer to ask Sol. Try “fit 8 kW on the east face” or “why is string B failing?”",
  },
  {
    id: "faces-from-heights",
    on: "face-traced",
    times: 1,
    words: "On a Nearmap picture, Design it for me reads the roof's faces from Nearmap's heights, each with its slope and direction.",
    act: "design-for-me",
  },
];

export const TIP_RULES = {
  /** Tips at most in one visit to the designer. */
  perVisit: 2,
  /** None in the first seconds of a visit. */
  quietSeconds: 20,
  /** A tip goes by itself after this long. */
  showSeconds: 10,
} as const;

/** What a person has said about tips, kept on their device. */
export interface TipPrefs {
  /** Tips switched off with the lightbulb. */
  off: boolean;
  /** The tips already shown (each once, ever). */
  seen: string[];
}

export const NO_TIP_PREFS: TipPrefs = { off: false, seen: [] };

/** Prefs read back from storage, whatever was there. */
export function cleanTipPrefs(raw: unknown): TipPrefs {
  const r = (raw ?? {}) as { off?: unknown; seen?: unknown };
  const known = new Set(DESIGN_TIPS.map((t) => t.id));
  const seen = Array.isArray(r.seen) ? [...new Set(r.seen.filter((s): s is string => typeof s === "string" && known.has(s)))] : [];
  return { off: r.off === true, seen };
}

/** The visit so far. */
export interface TipVisit {
  /** How many times each moment has come. */
  counts: Partial<Record<TipMoment, number>>;
  /** Tips shown this visit. */
  shown: number;
  /** When the visit began, and now (ms). */
  openedAt: number;
  now: number;
  /** Dragging or typing just now. */
  busy: boolean;
  /** A tip on screen already. */
  showing: boolean;
}

/**
 * The tip to show as a moment comes (its count already added to `visit.counts`), or null: tips off, too early, busy,
 * one on screen, the visit's tips used up, or no unseen tip whose moment has come often enough.
 */
export function tipFor(moment: TipMoment, visit: TipVisit, prefs: TipPrefs): DesignTip | null {
  if (prefs.off || visit.busy || visit.showing || visit.shown >= TIP_RULES.perVisit) return null;
  if (visit.now - visit.openedAt < TIP_RULES.quietSeconds * 1000) return null;
  const count = visit.counts[moment] ?? 0;
  return DESIGN_TIPS.find((t) => t.on === moment && count >= t.times && !prefs.seen.includes(t.id)) ?? null;
}

/** What the lightbulb says it does. */
export const bulbWords = (off: boolean) => (off ? "Tips are off: switch them on" : "Tips are on: switch them off");
