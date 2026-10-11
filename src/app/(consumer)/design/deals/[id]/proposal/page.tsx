import type { Metadata } from "next";
import { ProposalStudio } from "@/components/design/design-proposal";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Proposal", robots: { index: false, follow: false } };

/** A deal's proposal: the choices and what has been sent down the left, the customer's view of it beside them. */
export default async function DesignDealProposalPage({ params }: PageProps<"/design/deals/[id]/proposal">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount compact>
      <ProposalStudio jobId={id} />
    </DesignShell>
  );
}
