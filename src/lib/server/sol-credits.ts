/**
 * Server only. Taking Sol's credits for each answer (`domain/design/sol-credits.ts`), wherever Sol is asked, and keeping
 * what each answer really cost (`domain/ai-costs.ts`). Credits are taken before Claude is asked, so two answers can't
 * share the last ones, and given back when no answer came. How many, and which model answers, is `sol-routing.ts`.
 */
import { todayInMarket } from "@/lib/domain/market";
import { costOfCalls, toMicros, type AiUsage } from "@/lib/domain/ai-costs";
import type { SolUse } from "@/lib/domain/design/sol-credits";
import { solModel, TIER_CREDITS, type SolTier } from "@/lib/domain/design/sol-routing";
import { addToSolCredit, keepSolCost, refundSolCredit, spendSolCredit } from "./design-billing-repo";
import { isDemoBusiness } from "./design-demo-check";

/** Whether running out of design tokens or Sol credits stops anything (off until RENUABL's plans are live). Counted either way. */
export const billingEnforced = () => process.env.BILLING_ENFORCED?.trim() === "true";

/** The model for a tier here (`SOL_MODEL` for deep, `SOL_QUICK_MODEL` for quick). */
export const modelFor = (tier: SolTier) => solModel(tier, process.env);

/** Credits for an answer: the row's id, to add to, give back or keep the cost on, or null when too few are left. */
export async function takeSolCredit(businessId: string, use: SolUse, by: string | null, credits = 1): Promise<string | null> {
  return spendSolCredit(businessId, use, by, todayInMarket(), await enforcedFor(businessId), credits);
}

/** A demo account's allowance always holds (demo.ts), whatever billing is doing for everyone else. */
const enforcedFor = async (businessId: string) => billingEnforced() || (await isDemoBusiness(businessId).catch(() => false));

/** More credits on an answer begun: false when too few are left (billing enforced), and nothing is added. */
export async function addSolCredits(businessId: string, id: string, more: number): Promise<boolean> {
  return addToSolCredit(businessId, id, more, todayInMarket(), await enforcedFor(businessId));
}

/** Gives back credits whose answer never came. Never throws: a credit not given back is a small loss, not a failure. */
export async function giveBackSolCredit(businessId: string, id: string): Promise<void> {
  await refundSolCredit(businessId, id).catch((e) => console.error("sol credit not given back", e instanceof Error ? e.message : e));
}

/** What an answer cost, kept on its row: every call at its own model's rates. */
export function keepCost(businessId: string, id: string, tier: SolTier, reason: string, calls: readonly AiUsage[]): Promise<void> {
  const last = calls[calls.length - 1];
  return keepSolCost(businessId, id, {
    tier,
    model: last?.model ?? modelFor(tier),
    reason,
    costMicros: toMicros(costOfCalls(calls)),
    usage: calls,
  });
}

/** What a piece of Sol's work is handed: the model to ask, and where to report what it used. */
export interface SolAi {
  model: string;
  onUsage: (u: AiUsage) => void;
}

/**
 * Runs a piece of Sol's work with its credits taken: "out" when too few are left (nothing is run), else what it gave.
 * The work is given the tier's model and reports what it used, which is kept as its cost. Credits are given back when
 * it throws (and the error passed on).
 */
export async function withSolCredit<T>(
  businessId: string,
  use: SolUse,
  by: string | null,
  run: (ai: SolAi) => Promise<T>,
  tier: SolTier = "quick",
  reason: string = use,
): Promise<T | "out"> {
  const credit = await takeSolCredit(businessId, use, by, TIER_CREDITS[tier]);
  if (!credit) return "out";
  const calls: AiUsage[] = [];
  try {
    const out = await run({ model: modelFor(tier), onUsage: (u) => calls.push(u) });
    await keepCost(businessId, credit, tier, reason, calls);
    return out;
  } catch (e) {
    await giveBackSolCredit(businessId, credit);
    throw e;
  }
}
