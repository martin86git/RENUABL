import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { GridConnectionsPage } from "@/components/design/install-lists";

export const metadata: Metadata = { title: "Grid connections", robots: { index: false, follow: false } };

/** Grid connections: installed and inspected deals, waiting to be connected to the grid. */
export default function GridConnectionsRoute() {
  return (
    <DesignShell needsAccount>
      <GridConnectionsPage />
    </DesignShell>
  );
}
