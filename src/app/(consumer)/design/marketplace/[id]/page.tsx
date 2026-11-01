import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignShell } from "@/components/design/design-shell";
import { ListingPage } from "@/components/design/marketplace";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";

export const metadata: Metadata = { title: "Job listing", robots: { index: false, follow: false } };

/** One job listing on the Marketplace. */
export default async function Page({ params }: PageProps<"/design/marketplace/[id]">) {
  // Until it opens, the Marketplace is its launch page (marketplace-launch.ts).
  if (!marketplaceOpen()) redirect("/design/marketplace");
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <ListingPage id={id} />
    </DesignShell>
  );
}
