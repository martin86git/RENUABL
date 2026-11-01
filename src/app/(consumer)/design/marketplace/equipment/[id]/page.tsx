import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ItemPage } from "@/components/design/trade";

export const metadata: Metadata = { title: "Equipment for sale", robots: { index: false, follow: false } };

/** One item for sale on the Marketplace. */
export default async function Page({ params }: PageProps<"/design/marketplace/equipment/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <ItemPage id={id} />
    </DesignShell>
  );
}
