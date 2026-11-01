/**
 * Sol credits (Martin, 1 Nov 2026): what Sol's answers cost a business. Pure, tested (`sol-credits.test.ts`).
 *
 * One credit is one answer from Sol, wherever he is asked: his panel and Today's box, @Sol in team chat, an email
 * summarised or a reply drafted, an answer in a customer's proposal chat, a call written up, a usage figure found in the
 * customer's file. Each paid user brings `SOL_PER_USER` credits a calendar month (the market's month), which don't roll
 * over; a business on its free trial has `SOL_TRIAL` for the month instead. Credits bought in packs never expire and are
 * used only once the month's are gone. Prices include GST, as every price of RENUABL's does.
 */
import { dollars } from "./plans";

/** Included with each paid user, each calendar month. */
export const SOL_PER_USER = 200;
/** Included while the business is on its free trial (the whole business, not each user). */
export const SOL_TRIAL = 100;

/** The packs credits are sold in, cents GST inclusive. */
export const SOL_PACKS = [
  { credits: 500, cents: 2500 },
  { credits: 1000, cents: 4500 },
  { credits: 2500, cents: 10000 },
] as const;
export type SolPack = (typeof SOL_PACKS)[number];

/** A pack from the browser, by its credits: only one we sell. */
export function cleanSolPack(raw: unknown): SolPack | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return SOL_PACKS.find((p) => p.credits === n) ?? null;
}

/** What Sol is used for, kept on each credit used so the Billing page can say where they went. */
export const SOL_USES = ["chat", "channel", "inbox", "customer", "call-notes", "usage"] as const;
export type SolUse = (typeof SOL_USES)[number];
export const SOL_USE_WORDS: Record<SolUse, string> = {
  chat: "Asked Sol",
  channel: "@Sol in team chat",
  inbox: "Email summary or draft",
  customer: "Answered a customer",
  "call-notes": "Call written up",
  usage: "Usage found in a file",
};

/**
 * The month's included credits: every paid user's share while the plan is active (or past due, until Stripe gives
 * up), the trial's while trialing, else none.
 */
export function includedThisMonth(plan: { status: string; seats: number } | null): number {
  if (!plan) return 0;
  if (plan.status === "trialing") return SOL_TRIAL;
  if (plan.status === "active" || plan.status === "past_due") return SOL_PER_USER * Math.max(1, plan.seats);
  return 0;
}

export interface SolBalance {
  /** Included this month. */
  included: number;
  /** Of those, used. */
  usedIncluded: number;
  /** Bought and not yet used. */
  bought: number;
  /** Everything that can still be used now. */
  left: number;
}

export function solBalance(included: number, usedIncluded: number, boughtLeft: number): SolBalance {
  const fromMonth = Math.max(0, included - usedIncluded);
  const bought = Math.max(0, boughtLeft);
  return { included, usedIncluded, bought, left: fromMonth + bought };
}

/** Where the next answer's credit comes from: the month's first, then a bought one; none when both are gone. */
export function creditSource(balance: SolBalance): "included" | "bought" | null {
  if (balance.usedIncluded < balance.included) return "included";
  return balance.bought > 0 ? "bought" : null;
}

/** "2026-11": the month a credit is counted in, from the market's own date. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/** What Sol says, and the screens say, when the credits are gone. */
export const SOL_OUT =
  "That's this month's Sol credits used. The owner can add more in Settings → Billing, and the month's own come back on the 1st.";
/** Said where an answer simply doesn't happen (an email summary, a call write-up). */
export const SOL_OUT_SHORT = "No Sol credits left this month. The owner can add more in Settings → Billing.";

export const SOL_WORDS = {
  perUser: `${SOL_PER_USER} Sol credits a user each month`,
  explained: `One credit is one answer from Sol. Each user brings ${SOL_PER_USER} a month, which start again on the 1st. Credits you buy never expire, and are used once the month's are gone.`,
  pack: (p: SolPack) => `${p.credits.toLocaleString("en-AU")} credits · ${dollars(p.cents)}`,
} as const;
