/**
 * The phone dock's two sets of tools (23 Nov 2026, Martin: a solar business's owner wears every hat, so the dock flips
 * between the sales tools and the post-sale ones, like a slot machine, from a ball in a lip on the dock; the page stays
 * the same calm Today, and only what it shows by default follows the dock). Kept on the device.
 */
export const DOCK_SETS = ["sales", "post", "market"] as const;
export type DockSet = (typeof DOCK_SETS)[number];

/** Where the set is kept on the device. */
export const DOCK_SET_KEY = "renuabl.design.dock-set";

/** What was kept, read safely: anything else is the sales tools. */
export function cleanDockSet(raw: unknown): DockSet {
  return DOCK_SETS.find((s) => s === raw) ?? "sales";
}

/**
 * The set the ball turns the dock to next: sales, post sale, the Marketplace, then round to sales (23 Nov 2026, Martin:
 * "We should make a 3rd orb toggle position - marketplace").
 */
export function nextDockSet(set: DockSet): DockSet {
  return DOCK_SETS[(DOCK_SETS.indexOf(set) + 1) % DOCK_SETS.length];
}

/** Where a set sits on the dock's reels, top first. */
export const reelPlace = (set: DockSet): number => DOCK_SETS.indexOf(set);

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
  // Today keeps the sales view on the Marketplace's tools: the Marketplace is its own pages, not the business's day.
  market: {
    name: "Marketplace tools",
    turnTo: "Turn the dock to the Marketplace",
    feed: "Feed",
    ask: "Ask about the business: why are we down on last month?",
  },
};

/** The jobs installing on a day: sold, not lost, with that install date, by customer. */
export function installingOn<T extends { installDate: string | null; stage: string; customerName: string }>(
  jobs: readonly T[],
  day: string,
): T[] {
  return jobs.filter((j) => j.installDate === day && j.stage !== "lost").sort((a, b) => a.customerName.localeCompare(b.customerName));
}
