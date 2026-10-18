import type { Metadata } from "next";
import { ProposalsPage } from "@/components/design/design-proposals-list";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Proposals sent", robots: { index: false, follow: false } };

/** Every proposal out with a customer and not yet signed. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ProposalsPage signed={false} />
    </DesignShell>
  );
}
