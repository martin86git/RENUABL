/**
 * The phone dock's two sets of tools (23 Nov 2026, Martin: a solar business's owner wears every hat, so the dock flips
 * between the sales tools and the post-sale ones, like a slot machine, from a ball in a lip on the dock; the page stays
 * the same calm Today, and only what it shows by default follows the dock). Kept on the device.
 */
export const DOCK_SETS = ["sales", "post"] as const;
export type DockSet = (typeof DOCK_SETS)[number];

/** Where the set is kept on the device. */
export const DOCK_SET_KEY = "renuabl.design.dock-set";

/** What was kept, read safely: anything else is the sales tools. */
export function cleanDockSet(raw: unknown): DockSet {
  return raw === "post" ? "post" : "sales";
}

/** The other set: the ball turns the dock to it. */
export function otherDockSet(set: DockSet): DockSet {
  return set === "sales" ? "post" : "sales";
}

/** Words for each set, on the ball and on Today. */
export const DOCK_SET_WORDS: Record<DockSet, { name: string; turnTo: string; feed: string; ask: string }> = {
  sales: {
    name: "Sales tools",
    turnTo: "Turn the dock to the sales tools",
    feed: "Feed",
    ask: "Ask about the business: why are we down on last month?",
  },
  post: {
    name: "Post sale tools",
    turnTo: "Turn the dock to the post sale tools",
    feed: "Jobs",
    ask: "Ask about jobs: what isn't ordered for next week?",
  },
};

/** The jobs installing on a day: sold, not lost, with that install date, by customer. */
export function installingOn<T extends { installDate: string | null; stage: string; customerName: string }>(
  jobs: readonly T[],
  day: string,
): T[] {
  return jobs.filter((j) => j.installDate === day && j.stage !== "lost").sort((a, b) => a.customerName.localeCompare(b.customerName));
}
