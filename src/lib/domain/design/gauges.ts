/**
 * RENUABL's own way of showing progress (24 Oct 2026, Martin: the rings needed
 * a feel native to RENUABL): **the sun over the array**. A goal is a solar
 * panel array that lights column by column, left to right, as it is reached;
 * the sun travels an arc over it from the first day of the period to the
 * last, and a line drops from the sun through the arrays: lit past the line is
 * ahead of pace, short of it behind. A count is a **panel tally**: one panel a
 * thing, lit when done, half-lit when partly done. Pure, tested.
 */
import { todayInMarket } from "../market";

/** How an array of `cells` panels lights for a share of its goal: whole panels, then one partly lit. */
export function arrayLight(share: number, cells: number): { full: number; part: number; over: number } {
  const s = Math.max(0, share);
  const lit = Math.min(s, 1) * cells;
  return { full: Math.floor(lit), part: lit - Math.floor(lit), over: s > 1 ? Math.round((s - 1) * 100) : 0 };
}

/** The share of the period gone by today (the sun's place on its arc): day 1 is its first light, the last day its end. */
export const dayShare = (day: number, days: number) => (days > 0 ? Math.min(1, Math.max(0, day / days)) : 0);

/** Whether a goal is ahead of the sun, behind it, or reached. */
export function paceOf(share: number, timeShare: number): "reached" | "ahead" | "behind" {
  if (share >= 1) return "reached";
  return share >= timeShare ? "ahead" : "behind";
}

export type PanelState = "done" | "part" | "todo";

/** A tally's panels, the done first, then the part done, then the rest: they read left to right as progress. */
export function tallyOrder(states: readonly PanelState[]): PanelState[] {
  const rank: Record<PanelState, number> = { done: 0, part: 1, todo: 2 };
  return [...states].sort((a, b) => rank[a] - rank[b]);
}

/** An upcoming install's panel: lit when both its installer is booked and its materials ordered, half when one is. */
export const installPanel = (booked: boolean, ordered: boolean): PanelState =>
  booked && ordered ? "done" : booked || ordered ? "part" : "todo";

/** A completed install's panel: lit when its paperwork (invoice paid, STCs claimed, grid connected) is all done, half when some is. */
export const paperworkPanel = (doneCount: number): PanelState => (doneCount >= 3 ? "done" : doneCount > 0 ? "part" : "todo");

/** This month's new deals as a tally: lit when sold, half-lit with a proposal out, dark while still a lead or designed. */
export function newDealPanels(
  jobs: readonly { stage: string; createdAt: string }[],
  today: string,
  wonStages: readonly string[],
): PanelState[] {
  const month = today.slice(0, 7);
  return jobs
    .filter((j) => j.stage !== "lost" && todayInMarket(new Date(j.createdAt)).startsWith(month))
    .map((j) => (wonStages.includes(j.stage) ? "done" : j.stage === "proposal" ? "part" : "todo"));
}
