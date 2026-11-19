import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ConfiguratorPage } from "@/components/design/configurator-page";
import { ProposalGone } from "@/components/design/proposal-view";
import { todayInMarket } from "@/lib/domain/market";
import { heldWeekFor, installWeekFor } from "@/lib/server/design-configurator";
import { proposalJob, publicProposal } from "@/lib/server/design-proposal-repo";

/** As the proposal's own page: out of search, no referrer, nothing of RENUABL's in its share details. */
export const metadata: Metadata = {
  title: { absolute: "Your system" },
  description: "Choose your system.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Your system", description: "Choose your system.", locale: "en_AU" },
  twitter: { card: "summary", title: "Your system", description: "Choose your system." },
};

/**
 * The proposal as a configurator (19 Nov 2026, Martin), beside the proposal page at the same private link. A proposal
 * published before the configurator (or with nothing to vary) has none, and opens its own page instead.
 */
export default async function ConfigureProposalPage({ params }: PageProps<"/p/[token]/configure">) {
  await connection();
  const { token } = await params;
  const found = await publicProposal(token, todayInMarket()).catch(() => null);
  if (!found) notFound();
  if (!found.view) return <ProposalGone business={found.business} />;
  if (!found.view.configurator) redirect(`/p/${encodeURIComponent(token)}`);
  const job = await proposalJob(token).catch(() => null);
  const [week, held] = job
    ? await Promise.all([installWeekFor(job.businessId).catch(() => null), heldWeekFor(job.businessId, job.jobId).catch(() => null)])
    : [null, null];
  return <ConfiguratorPage token={token} view={found.view} state={found.state} accepted={found.accepted} week={week} held={held} />;
}
