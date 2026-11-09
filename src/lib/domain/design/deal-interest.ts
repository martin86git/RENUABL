/**
 * What a new deal is for (9 Nov 2026, Martin: "What it is" didn't say what what was, and it was typed): the customer's
 * interest picked from a few choices, any of them together, and the deal named from them ("Solar and battery"). A deal
 * named some other way keeps its own words.
 */

export const INTERESTS = ["solar", "battery", "ev"] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_WORDS: Record<Interest, string> = { solar: "Solar", battery: "Battery", ev: "EV charger" };

/** "Solar", "Solar and battery", "Solar, battery and EV charger"; the order is always solar, battery, EV charger. */
export function interestTitle(picked: readonly Interest[]): string {
  const words = INTERESTS.filter((i) => picked.includes(i)).map((i, n) =>
    n === 0 ? INTEREST_WORDS[i] : i === "ev" ? INTEREST_WORDS[i] : INTEREST_WORDS[i].toLowerCase(),
  );
  if (words.length < 2) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The choices a deal's name came from, or null when it was written some other way. */
export function interestsOf(title: string): Interest[] | null {
  const t = title.trim();
  if (!t) return [];
  const sets: Interest[][] = [];
  for (let mask = 1; mask < 1 << INTERESTS.length; mask++) sets.push(INTERESTS.filter((_, i) => mask & (1 << i)));
  return sets.find((s) => interestTitle(s).toLowerCase() === t.toLowerCase()) ?? null;
}

/** Picking or unpicking one choice, from the deal's name as it is now. */
export function toggleInterest(title: string, choice: Interest): string {
  const now = interestsOf(title) ?? [];
  return interestTitle(now.includes(choice) ? now.filter((i) => i !== choice) : [...now, choice]);
}
