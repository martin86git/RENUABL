import type { Metadata } from "next";
import { BrandSettings } from "@/components/design/design-proposal";
import { DesignShell } from "@/components/design/design-shell";

export const metadata: Metadata = { title: "Proposal branding", robots: { index: false, follow: false } };

/** A business's own name, logo, colours, pictures and words for the proposals it sends its customers. */
export default function DesignBrandPage() {
  return (
    <DesignShell needsAccount>
      <BrandSettings />
    </DesignShell>
  );
}
