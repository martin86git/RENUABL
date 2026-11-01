import type { Metadata } from "next";
import { ApprovalsPage } from "@/components/design/approvals";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Pre-approvals", robots: { index: false, follow: false } };

/** Sold jobs waiting at this approval gate (domain/design/approvals.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ApprovalsPage gate="preapproval" />
    </DesignShell>
  );
}
