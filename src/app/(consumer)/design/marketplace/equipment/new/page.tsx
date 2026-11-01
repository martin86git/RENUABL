import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { NewItemPage } from "@/components/design/trade";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Sell equipment", robots: { index: false, follow: false } };

export default function Page() {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  return (
    <DesignShell needsAccount>
      <NewItemPage />
    </DesignShell>
  );
}
