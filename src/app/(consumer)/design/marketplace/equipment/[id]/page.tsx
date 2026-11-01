import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { ItemPage } from "@/components/design/trade";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Equipment for sale", robots: { index: false, follow: false } };

/** One item for sale on the Marketplace. */
export default async function Page({ params }: PageProps<"/design/marketplace/equipment/[id]">) {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <ItemPage id={id} />
    </DesignShell>
  );
}
