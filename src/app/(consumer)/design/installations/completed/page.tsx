import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { AfterInstallPage } from "@/components/design/install-lists";

export const metadata: Metadata = { title: "After install", robots: { index: false, follow: false } };

/** After install: each installed job taken through invoice, CoES, STCs and grid connection. */
export default function CompletedInstallationsPage() {
  return (
    <DesignShell needsAccount>
      <AfterInstallPage />
    </DesignShell>
  );
}
