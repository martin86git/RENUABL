import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { SalesPage } from "@/components/design/design-sales";

export const metadata: Metadata = { title: "Sales", robots: { index: false, follow: false } };

/** A business's jobs by stage. */
export default function DesignSalesPage() {
  return (
    <DesignShell needsAccount>
      <SalesPage />
    </DesignShell>
  );
}
