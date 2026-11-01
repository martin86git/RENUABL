import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { MarketplacePage } from "@/components/design/marketplace";
import { MarketplaceLaunch } from "@/components/design/marketplace-launch";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Marketplace", robots: { index: false, follow: false } };

/**
 * The Marketplace (domain/design/marketplace.ts). Until it opens, its launch page: what it is and a place on the list,
 * signed in or out (marketplace-launch.ts).
 */
export default function Page() {
  if (!marketplaceOpen())
    return (
      <DesignShell>
        <MarketplaceLaunch />
      </DesignShell>
    );
  return (
    <DesignShell needsAccount>
      <MarketplacePage view="browse" />
    </DesignShell>
  );
}
