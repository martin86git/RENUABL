import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { JobMapPage } from "@/components/design/design-job-map";

export const metadata: Metadata = { title: "Job map", robots: { index: false, follow: false } };

/** The job map: where each job is, the base, and where its stock is collected. */
export default function DesignJobMapPage() {
  return (
    <DesignShell needsAccount>
      <JobMapPage />
    </DesignShell>
  );
}
