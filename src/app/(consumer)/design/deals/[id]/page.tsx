import type { Metadata } from "next";
import { DealPage } from "@/components/design/design-deal";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Deal", robots: { index: false, follow: false } };

/** One deal: what the installation needs down the left, and what has been said and done beside it. */
export default async function DesignDealPage({ params }: PageProps<"/design/deals/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <DealPage id={id} />
    </DesignShell>
  );
}
