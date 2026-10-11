/**
 * Server only. Works a job's proposal out from what is saved, for the
 * preview a member sees and for publishing: the same function for both, so
 * what is previewed is what is sent. The browser supplies only the choices
 * (template, how long the price stands, a note); every figure comes from the
 * saved design, the business's own prices and today's rebate rules.
 */
import { todayInMarket } from "@/lib/domain/market";
import { buildProposal, cleanChoice, type Built, type ProposalChoice } from "@/lib/domain/design/proposal";
import { NO_DESIGN, savedFor, type Saved } from "./design-proposal-repo";
import type { Member } from "./design-repo";
import { getRebateRates } from "./rebate-rates";

export interface WorkedOut {
  saved: Saved;
  choice: ProposalChoice;
  built: Built;
}

/** Null when the business has no such job; `NO_DESIGN` when the job has no roof design to price. */
export async function workOutProposal(member: Member, jobId: string, choice: unknown): Promise<WorkedOut | typeof NO_DESIGN | null> {
  const saved = await savedFor(member.businessId, member.businessName, jobId);
  if (!saved || saved === NO_DESIGN) return saved;
  const now = new Date();
  const chosen = cleanChoice(choice, saved.brand);
  const { rates } = await getRebateRates();
  const built = buildProposal({
    now: now.toISOString(),
    today: todayInMarket(now),
    version: saved.nextVersion,
    job: saved.job,
    customer: saved.customer,
    project: saved.project,
    workspace: saved.workspace,
    rates,
    brand: saved.brand,
    images: saved.images,
    choice: chosen,
  });
  return { saved, choice: chosen, built };
}
