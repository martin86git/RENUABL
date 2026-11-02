import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InspectionPage } from "@/components/design/inspections";

export const metadata: Metadata = { title: "Inspection", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** One inspection: the job read only, and where it stands (domain/design/inspections.ts). */
export default async function Page({ params }: PageProps<"/design/inspections/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <InspectionPage id={id} />
    </DesignShell>
  );
}
