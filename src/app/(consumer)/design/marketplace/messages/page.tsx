import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { MarketplaceMessagesPage } from "@/components/design/marketplace-messages";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

/** The Marketplace's conversations between businesses, as seller or buyer. */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <MarketplaceMessagesPage />
    </DesignShell>
  );
}
