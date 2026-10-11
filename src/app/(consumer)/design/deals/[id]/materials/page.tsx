import type { Metadata } from "next";
import { DealMaterials } from "@/components/design/design-materials";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Materials order", robots: { index: false, follow: false } };

/** A job's bill of materials, as the order sheet to send to a supplier. */
export default async function DesignDealMaterialsPage({ params }: PageProps<"/design/deals/[id]/materials">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <DealMaterials id={id} />
    </DesignShell>
  );
}
