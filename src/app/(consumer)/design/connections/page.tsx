import type { Metadata } from "next";
import { ConnectionsPage } from "@/components/design/connections";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Connections", robots: { index: false, follow: false } };

/** The businesses this one works with (domain/design/connections.ts): retailers, installers and inspectors. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <ConnectionsPage />
    </DesignShell>
  );
}
