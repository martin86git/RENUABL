/**
 * RENUABL's progress visuals (24 Oct 2026, Martin: the RENUABL way is that of leaders who think different, as Apple and
 * Tesla do: restraint): the sun keeps time, travelling its arc across the period, with a line dropping from it; a goal
 * is one hairline grown toward it, ahead of the sun or behind; a count is a row of fine ticks, lit when done, half-lit
 * when partly done. Pure, tested.
 */
import { todayInMarket } from "../market";

/** The share of the period gone by today (the sun's place on its arc): day 1 is its first light, the last day its end. */
export const dayShare = (day: number, days: number) => (days > 0 ? Math.min(1, Math.max(0, day / days)) : 0);

/** Whether a goal is ahead of the sun, behind it, or reached. */
export function paceOf(share: number, timeShare: number): "reached" | "ahead" | "behind" {
  if (share >= 1) return "reached";
  return share >= timeShare ? "ahead" : "behind";
}

export type PanelState = "done" | "part" | "todo";

/** A tally's ticks, the done first, then the part done, then the rest: they read left to right as progress. */
export function tallyOrder(states: readonly PanelState[]): PanelState[] {
  const rank: Record<PanelState, number> = { done: 0, part: 1, todo: 2 };
  return [...states].sort((a, b) => rank[a] - rank[b]);
}

/** An upcoming install's tick: lit when both its installer is booked and its materials ordered, half when one is. */
export const installPanel = (booked: boolean, ordered: boolean): PanelState =>
  booked && ordered ? "done" : booked || ordered ? "part" : "todo";

/** A completed install's tick: lit when its paperwork (invoice paid, STCs claimed, grid connected) is all done, half when some is. */
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
