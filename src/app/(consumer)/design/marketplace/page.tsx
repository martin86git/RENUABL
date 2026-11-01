import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { MarketplacePage } from "@/components/design/marketplace";

export const metadata: Metadata = { title: "Job listings", robots: { index: false, follow: false } };

/** The Marketplace (domain/design/marketplace.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <MarketplacePage view="browse" />
    </DesignShell>
  );
}
