import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { TradePage } from "@/components/design/trade";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Equipment", robots: { index: false, follow: false } };

/** Spare equipment other businesses are selling (domain/design/trade.ts). */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <TradePage view="browse" />
    </DesignShell>
  );
}
