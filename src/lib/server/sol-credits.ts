/**
 * Server only. Taking a Sol credit for each answer (`domain/design/sol-credits.ts`), wherever Sol is asked. A credit is
 * taken before Claude is asked, so two answers can't share the last one, and given back when no answer came.
 */
import { todayInMarket } from "@/lib/domain/market";
import type { SolUse } from "@/lib/domain/design/sol-credits";
import { refundSolCredit, spendSolCredit } from "./design-billing-repo";

/** Whether running out of design tokens or Sol credits stops anything (off until RENUABL's plans are live). Counted either way. */
export const billingEnforced = () => process.env.BILLING_ENFORCED?.trim() === "true";

/** One credit for an answer: its id, to give back if the answer fails, or null when there are none left. */
export function takeSolCredit(businessId: string, use: SolUse, by: string | null): Promise<string | null> {
  return spendSolCredit(businessId, use, by, todayInMarket(), billingEnforced());
}

/** Gives back a credit whose answer never came. Never throws: a credit not given back is a small loss, not a failure. */
export async function giveBackSolCredit(businessId: string, id: string): Promise<void> {
  await refundSolCredit(businessId, id).catch((e) => console.error("sol credit not given back", e instanceof Error ? e.message : e));
}

/**
 * Runs an answer with a credit taken for it: "out" when there are none left (nothing is run), else what it gave. The
 * credit is given back when it throws (and the error passed on).
 */
export async function withSolCredit<T>(businessId: string, use: SolUse, by: string | null, run: () => Promise<T>): Promise<T | "out"> {
  const credit = await takeSolCredit(businessId, use, by);
  if (!credit) return "out";
  try {
    return await run();
  } catch (e) {
    await giveBackSolCredit(businessId, credit);
    throw e;
  }
}
