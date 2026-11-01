import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { MarketplacePage } from "@/components/design/marketplace";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "My listings", robots: { index: false, follow: false } };

/** The Marketplace (domain/design/marketplace.ts). */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <MarketplacePage view="mine" />
    </DesignShell>
  );
}
