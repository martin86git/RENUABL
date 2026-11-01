import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ListingPage } from "@/components/design/marketplace";

export const metadata: Metadata = { title: "Job listing", robots: { index: false, follow: false } };

/** One job listing on the Marketplace. */
export default async function Page({ params }: PageProps<"/design/marketplace/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <ListingPage id={id} />
    </DesignShell>
  );
}
