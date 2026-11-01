import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { TradePage } from "@/components/design/trade";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "My equipment", robots: { index: false, follow: false } };

/** What this business has put up for sale. */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <TradePage view="mine" />
    </DesignShell>
  );
}
