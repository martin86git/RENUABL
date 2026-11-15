import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignShell } from "@/components/design/design-shell";
import { MarketingFrame } from "@/components/design/marketing/marketing-nav";

export const metadata: Metadata = { title: { default: "Marketing", template: "%s · Marketing" }, robots: { index: false, follow: false } };

/** Marketing in RENUABL Business: the business's contacts, campaigns, sequences and settings, where it is switched on. */
export default function MarketingLayout({ children }: LayoutProps<"/design/marketing">) {
  return (
    <DesignShell needsAccount>
      <Suspense>
        <MarketingFrame>{children}</MarketingFrame>
      </Suspense>
    </DesignShell>
  );
}
