import type { Metadata } from "next";
import { ProposalsPage } from "@/components/design/design-proposals-list";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Signed proposals", robots: { index: false, follow: false } };

/** Every proposal a customer has signed. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ProposalsPage signed />
    </DesignShell>
  );
}
