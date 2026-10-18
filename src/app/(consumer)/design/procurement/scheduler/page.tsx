import type { Metadata } from "next";
import { SchedulerPage } from "@/components/design/design-scheduler";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Install Scheduler", robots: { index: false, follow: false } };

/** The business's booked installations on a calendar. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <SchedulerPage />
    </DesignShell>
  );
}
