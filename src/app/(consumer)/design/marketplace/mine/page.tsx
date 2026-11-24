import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { MarketplacePage } from "@/components/design/marketplace";
import { TradePage } from "@/components/design/trade";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "My listings", robots: { index: false, follow: false } };

/**
 * Everything this business has out on the Marketplace (23 Nov 2026, Martin: "my listings… contain any bid information
 * for an install or any bid information for goods being sold"): its jobs out for bids, then its equipment for sale with
 * the businesses asking about each.
 */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <MarketplacePage view="mine" />
      <div className="mt-8">
        <TradePage view="mine" />
      </div>
    </DesignShell>
  );
}
