import type { Metadata } from "next";
import { InstallationsPage } from "@/components/design/design-installations";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Installations", robots: { index: false, follow: false } };

/** Every installation in the works: sold, and not yet on the roof. */
export default function DesignInstallationsPage() {
  return (
    <DesignShell needsAccount>
      <InstallationsPage />
    </DesignShell>
  );
}
