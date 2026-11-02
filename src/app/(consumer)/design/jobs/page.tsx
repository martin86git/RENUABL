import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallerJobsPage } from "@/components/design/installer-jobs";

export const metadata: Metadata = { title: "Jobs", robots: { index: false, follow: false } };

/** An installer's jobs from the retailers it is connected with (domain/design/job-shares.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <InstallerJobsPage />
    </DesignShell>
  );
}
