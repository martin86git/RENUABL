/**
 * The battery hero on a customer's proposal (8 Nov 2026, Martin: "when you're selling a battery there's no replacement
 * for the rooftop array image… the proposal isn't about the array and is about the battery").
 *
 * When the system has a battery, the proposal opens on it instead of the panels:
 * - **battery only** (no solar on the design, or a home that keeps its own solar): `day`, the home's day drawn with the
 *   sun's arc: the afternoon sun fills the battery, the battery runs the evening, the grid is left for the small hours;
 * - **solar and a battery**: `roof`, the roof design stays the picture ("your system") with the battery story laid
 *   over a corner of it ("and your evenings"); when the business has switched the roof off, the day is drawn instead;
 * - **solar only**: nothing (`null`), the proposal is as it was.
 *
 * Words only from the customer's own copy (`ProposalView`): the battery's size, the home's daily use from their bill,
 * blackout backup. Never a cost, margin or product code, never a saving or output figure (those stay in their own
 * blocks, with their notes, and are left out for homes outside Victoria). A share of the home's use is an estimate,
 * rounded down, and says so.
 */
import { contrast } from "./brand";
import { recommendedGoal, type OptionKey, type ProposalView } from "./proposal";

export type BatteryHeroKind = "day" | "roof";

/** One part of the battery's day, in the order it happens. */
export interface BatteryStage {
  id: "afternoon" | "evening" | "night";
  when: string;
  words: string;
}

export interface BatteryHero {
  kind: BatteryHeroKind;
  /** What the battery holds in all, kWh. */
  kwh: number;
  /** A module held back to keep chosen circuits on in a blackout. */
  backup: boolean;
  /** The line over the picture. */
  headline: string;
  /** Short plain lines under it: what it holds, against the home's own use, blackout backup. */
  says: string[];
  stages: BatteryStage[];
  /** The note that goes with it: a guide to the day, not a forecast. */
  note: string;
  /** The picture described in words, for a screen reader. */
  label: string;
}

export const BATTERY_STAGES: BatteryStage[] = [
  { id: "afternoon", when: "Afternoon", words: "Spare sun fills the battery." },
  { id: "evening", when: "Evening", words: "The battery runs your home." },
  { id: "night", when: "Small hours", words: "The grid covers what's left." },
];

export const BACKUP_LINE = "In a blackout, it keeps your chosen circuits going.";

export const BATTERY_HERO_NOTE =
  "A guide to how a battery works through a day, not a forecast. How far it goes each evening depends on the weather and how the home uses power.";

/** Whether the battery in the view is held partly for blackouts: the chosen option's (or the recommended one's) mark. */
function backupOf(view: Pick<ProposalView, "options">, chosen: OptionKey | null | undefined): boolean {
  const goal = chosen ?? recommendedGoal(view);
  return Boolean(view.options?.find((o) => o.goal === goal)?.backup);
}

/**
 * The battery against a day of the home's use, from the bill: "about 60% of a day's use", rounded down to the ten, or
 * "about a full day's use". Null without a bill or a daily figure.
 */
export function shareOfDay(kwh: number, dailyKwh: number | null | undefined): string | null {
  if (!dailyKwh || dailyKwh <= 0 || kwh <= 0) return null;
  const share = kwh / dailyKwh;
  if (share >= 1) return "That's about a full day of your home's use (estimate).";
  const tens = Math.floor(share * 10) * 10;
  if (tens < 10) return null;
  return `That's about ${tens}% of a day's use in your home (estimate).`;
}

/** A battery size as it is written: "13.5", "16". */
const kwhWords = (kwh: number) => (Math.round(kwh * 10) / 10).toLocaleString("en-AU");

/**
 * The battery hero for the view as it is shown (`viewForChoice` already applied), or null with no battery.
 * `roofShown`: whether the business shows the roof on this proposal (the roof block is on); without it, a solar and
 * battery system is drawn as the day too.
 */
export function batteryHero(
  view: Pick<ProposalView, "system" | "roof" | "bill" | "options">,
  opts: { roofShown: boolean; chosen?: OptionKey | null },
): BatteryHero | null {
  const kwh = view.system.batteryKwh;
  if (!(kwh > 0)) return null;
  const solar = view.system.kw > 0 && view.roof.panels.length > 0;
  const kind: BatteryHeroKind = solar && opts.roofShown ? "roof" : "day";
  const backup = backupOf(view, opts.chosen);
  const size = kwhWords(kwh);
  const share = shareOfDay(kwh, view.bill?.dailyKwh);
  const says = [`Holds up to ${size} kWh for your evenings.`, ...(share ? [share] : []), ...(backup ? [BACKUP_LINE] : [])];
  return {
    kind,
    kwh,
    backup,
    headline: kind === "roof" ? "And your evenings" : `Your home's day, with a ${size} kWh battery.`,
    says,
    stages: BATTERY_STAGES,
    note: BATTERY_HERO_NOTE,
    label:
      kind === "roof"
        ? `The panels on the roof, seen from above, with a ${size} kWh battery: the panels fill it by day and it runs the home in the evening.`
        : `A home through one day: the afternoon sun fills a ${size} kWh battery, the battery runs the home in the evening, and the grid covers the small hours.`,
  };
}

/** Every word the hero puts on the page, for the test that no cost word reaches a customer. */
export const heroWords = (hero: BatteryHero): string =>
  [hero.headline, ...hero.says, ...hero.stages.flatMap((s) => [s.when, s.words]), hero.note, hero.label].join(" ");

/** The dark the battery is laid over on the roof picture. */
export const HERO_DARK = "#111827";

/**
 * The colour the battery's charge is drawn in over the dark: the business's main colour when it reads there, else
 * white (a navy or graphite brand would vanish against it).
 */
export const heroGlow = (primary: string): string => (contrast(primary, HERO_DARK) >= 3 ? primary : "#ffffff");
