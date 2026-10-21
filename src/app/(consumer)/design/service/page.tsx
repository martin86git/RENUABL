import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { ServicePlanner } from "@/components/design/design-service";

export const metadata: Metadata = { title: "Service pipeline", robots: { index: false, follow: false } };

/** The service pipeline: every job flagged with something to put right after the sale. */
export default function DesignServicePage() {
  return (
    <DesignShell needsAccount>
      <ServicePlanner />
    </DesignShell>
  );
}
