/**
 * Each call under way as a round on the rail (13 Nov 2026, Martin: especially when several calls are under way, I need
 * to see a representation of each one). Under the phone assistant's face: one small round a call, the customer's
 * initials, lit while they are talking and quieter while it rings; past a few, the rest as a count. Pure, tested.
 */

/** How many calls get a round of their own before the rest are counted. */
export const RAIL_CALLS_MAX = 4;

/** A customer's initials: the first letters of their first and last names; "?" when there is no name. */
export function callInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  if (!words.length) return "?";
  const first = words[0].match(/\p{L}/u)?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1].match(/\p{L}/u)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** The calls given a round, and how many more there are. */
export function railCalls<T>(calls: readonly T[], max = RAIL_CALLS_MAX): { shown: T[]; more: number } {
  // With one too many, the last place is better spent on that call than on "+1".
  const shown = calls.length <= max ? [...calls] : calls.slice(0, max - 1);
  return { shown, more: calls.length - shown.length };
}

/** What a call's round says when pointed at. */
export function railCallWords(
  c: { customer: string; deal: string; phase: "ringing" | "on-call"; by: string },
  clock: string | null,
): string {
  const who = c.customer.trim() || "A customer";
  const state = c.phase === "on-call" ? `on the call with ${c.by}${clock ? ` · ${clock}` : ""}` : `${c.by} is ringing`;
  return `${who} · ${state}${c.deal ? ` · ${c.deal}` : ""}`;
}
