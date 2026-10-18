import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { InstallationsPhasePage } from "@/components/design/install-lists";

export const metadata: Metadata = { title: "Completed installations", robots: { index: false, follow: false } };

/** Completed installations: installed, invoice paid, STCs claimed, grid connected. */
export default function CompletedInstallationsPage() {
  return (
    <DesignShell needsAccount>
      <InstallationsPhasePage phase="completed" />
    </DesignShell>
  );
}
