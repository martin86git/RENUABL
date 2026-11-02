import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InspectionsPage } from "@/components/design/inspections";

export const metadata: Metadata = { title: "Inspections", robots: { index: false, follow: false } };

/** An inspector's inspections, nominated by the installers it is connected with (domain/design/inspections.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <InspectionsPage />
    </DesignShell>
  );
}
