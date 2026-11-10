import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { JobsPage } from "@/components/design/jobs-page";
import { JOB_PHASES, type JobPhase } from "@/lib/domain/design/jobs-view";

export const metadata: Metadata = { title: "Jobs", robots: { index: false, follow: false } };

/** Every job by where it is in its life (domain/design/jobs-view.ts); ?stage= opens one stage. */
export default async function Page({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { stage } = await searchParams;
  const phase = JOB_PHASES.find((p) => p.id === stage)?.id as JobPhase | undefined;
  return (
    <DesignShell needsAccount>
      <JobsPage initialPhase={phase} />
    </DesignShell>
  );
}
