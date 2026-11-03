import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { WatchingScreen } from "@/components/design/market-watching";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Watching", robots: { index: false, follow: false } };

/** What this person is watching on the Marketplace: jobs and equipment (market-alerts.ts). */
export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <WatchingScreen />
    </DesignShell>
  );
}
