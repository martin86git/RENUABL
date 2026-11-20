/**
 * Codes for the plan (20 Nov 2026, Martin: "a code field, where a code determines whether you get a month off, 2 months
 * off, or indefinite"). A code is a Stripe promotion code on a coupon of RENUABL's making: the plan free for a number of
 * months, or for good. RENUABL's staff make them on /admin; a new business types one at sign-up and Stripe takes it off
 * the bills. A code takes the place of the usual first-month price; it never adds to it.
 */

/** How long a code takes the plan off: a number of months, or for good. */
export type CodeLength = { months: number } | "forever";

/** The lengths offered when making a code. */
export const CODE_LENGTHS: readonly CodeLength[] = [{ months: 1 }, { months: 2 }, { months: 3 }, { months: 6 }, { months: 12 }, "forever"];

export const PLAN_CODE_LIMITS = { min: 3, max: 30, uses: 10_000 } as const;

export const PLAN_CODE_WORDS = {
  field: "Have a code?",
  placeholder: "Code",
  apply: "Apply",
  notFound: "That code isn't one we know, or it has been used up.",
  badCode: "A code is 3 to 30 letters, numbers or dashes.",
  forever: "Your plan is free for as long as you have it. No card needed.",
} as const;

/** A code as typed: upper case, letters, numbers and dashes only; null when it can't be one. */
export function cleanPlanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return code.length >= PLAN_CODE_LIMITS.min && code.length <= PLAN_CODE_LIMITS.max && /^[A-Z0-9-]+$/.test(code) ? code : null;
}

/** A length chosen on /admin, or null. */
export function cleanCodeLength(raw: unknown): CodeLength | null {
  if (raw === "forever") return "forever";
  const months = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return CODE_LENGTHS.some((l) => l !== "forever" && l.months === months) ? { months } : null;
}

/** The coupon a code points at, as Stripe gives it. */
export interface CodeCoupon {
  percentOff: number | null;
  duration: "once" | "repeating" | "forever";
  months: number | null;
}

/** What a code gives, in words: "First month free", "First 2 months free", "Free for good", "50% off for 3 months". */
export function codeWords(c: CodeCoupon): string {
  const free = c.percentOff === 100;
  const months = c.duration === "once" ? 1 : (c.months ?? 1);
  if (c.duration === "forever") return free ? "Free for good" : `${c.percentOff ?? 0}% off for as long as you have the plan`;
  if (free) return months === 1 ? "First month free" : `First ${months} months free`;
  return `${c.percentOff ?? 0}% off for ${months === 1 ? "the first month" : `${months} months`}`;
}

/** Whether a code makes the plan free for good, so no card is asked for. */
export const freeForGood = (c: CodeCoupon) => c.duration === "forever" && c.percentOff === 100;

/** The words a length is shown with on /admin. */
export const lengthWords = (l: CodeLength) =>
  l === "forever" ? "Free for good" : l.months === 1 ? "First month free" : `First ${l.months} months free`;
