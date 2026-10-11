import type { Metadata } from "next";
import { PipelinesPage } from "@/components/design/design-sales";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Pipelines", robots: { index: false, follow: false } };

/** A business's deals, by the stages of the pipeline being looked at, as cards or as a list. */
export default function DesignPipelinesPage() {
  return (
    <DesignShell needsAccount>
      <PipelinesPage />
    </DesignShell>
  );
}
