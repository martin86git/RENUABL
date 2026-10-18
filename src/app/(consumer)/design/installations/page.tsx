import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallationsPhasePage } from "@/components/design/install-lists";

export const metadata: Metadata = { title: "Upcoming installations", robots: { index: false, follow: false } };

/** Upcoming installations: sold, and the day not come yet (or not booked). */
export default function DesignInstallationsPage() {
  return (
    <DesignShell needsAccount>
      <InstallationsPhasePage phase="upcoming" />
    </DesignShell>
  );
}
