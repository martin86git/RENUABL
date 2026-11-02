import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallerJobPage } from "@/components/design/installer-jobs";

export const metadata: Metadata = { title: "Job card", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** One accepted job's card, inside the installer's login (domain/design/job-shares.ts). */
export default async function Page({ params }: PageProps<"/design/jobs/[id]">) {
  const { id } = await params;
  return (
    <DesignShell needsAccount>
      <InstallerJobPage id={id} />
    </DesignShell>
  );
}
