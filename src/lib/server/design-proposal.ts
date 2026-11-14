/**
 * Server only. Works a job's proposal out from what is saved, for the
 * preview a member sees and for publishing: the same function for both, so
 * what is previewed is what is sent. The browser supplies only the choices
 * (template, how long the price stands, a note); every figure comes from the
 * saved design, the business's own prices and today's rebate rules.
 */
import { todayInMarket } from "@/lib/domain/market";
import { buildProposal, cleanChoice, type Built, type ProposalChoice } from "@/lib/domain/design/proposal";
import { NO_DESIGN, proposalVersions, savedFor, type Saved } from "./design-proposal-repo";
import type { Member } from "./design-repo";
import { roofImagery } from "./design-nearmap-repo";
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
  // Unless chosen: as the last one sent (so the design tool publishing on every save never turns an indicative
  // proposal final), and with none sent yet, indicative for a lead or a designed roof: their thoughts before a visit.
  const latest = (await proposalVersions(member.businessId, jobId, todayInMarket(now)))[0];
  const usual = latest ? latest.indicative : saved.job.stage === "lead" || saved.job.stage === "designed";
  const chosen = cleanChoice(choice, saved.brand, usual);
  const { rates } = await getRebateRates();
  // The picture the design was drawn on: a Nearmap capture lines the panels up where Google's leaning photo doesn't.
  const imagery = await roofImagery(member.businessId, saved.project.lat, saved.project.lng).catch(() => null);
  const built = buildProposal({
    now: now.toISOString(),
    today: todayInMarket(now),
    version: saved.nextVersion,
    job: saved.job,
    customer: saved.customer,
    project: saved.project,
    picture: imagery && imagery.use !== "google" ? imagery.use : null,
    workspace: saved.workspace,
    rates,
    brand: saved.brand,
    images: saved.images,
    choice: chosen,
  });
  return { saved, choice: chosen, built };
}
