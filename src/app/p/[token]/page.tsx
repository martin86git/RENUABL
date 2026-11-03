import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CustomerProposal } from "@/components/design/proposal-customer";
import { ProposalGone } from "@/components/design/proposal-view";
import { todayInMarket } from "@/lib/domain/market";
import { proposalJob, publicProposal } from "@/lib/server/design-proposal-repo";
import { callMeFor } from "@/lib/server/voice-calls";

/**
 * Kept out of search, and the page it links to is never told where the
 * visitor came from: the address of this page is the key to it. Its own
 * title, description and share details, so none of RENUABL's site-wide ones
 * (name, tagline, picture) show when the link is passed on: the proposal is
 * the business's.
 */
export const metadata: Metadata = {
  title: { absolute: "Your proposal" },
  description: "A proposal prepared for you.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Your proposal", description: "A proposal prepared for you.", locale: "en_AU" },
  twitter: { card: "summary", title: "Your proposal", description: "A proposal prepared for you." },
};

/**
 * A proposal, opened by the customer it was sent to at its private link. No
 * sign-in: the 48 random characters in the address are the key. The page is
 * the business's, in its own name and colours: nothing of RENUABL's is on it,
 * and no ad tags run here. Only the customer's copy of the proposal is ever
 * loaded (`publicProposal`): the system, the price they pay, the rebate, the
 * estimates. A link that was never made is simply not found.
 */
export default async function ProposalLinkPage({ params }: PageProps<"/p/[token]">) {
  // Whether the price still stands depends on today.
  await connection();
  const { token } = await params;
  const found = await publicProposal(token, todayInMarket()).catch(() => null);
  if (!found) notFound();
  if (!found.view) return <ProposalGone business={found.business} />;
  // "Call me" only where the business has calls on (server/voice-calls.ts).
  const job = await proposalJob(token).catch(() => null);
  const callMe = job ? await callMeFor(job.businessId).catch(() => null) : null;
  return (
    <CustomerProposal
      token={token}
      view={found.view}
      state={found.state}
      accepted={found.accepted}
      deposit={found.deposit}
      payments={found.payments}
      callMe={callMe}
    />
  );
}
